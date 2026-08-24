"""
Services สำหรับจัดการ Generation Jobs
- แยก Business Logic ออกจาก API Layer
- ทำงานกับ Database, AI Server, และ File System
"""
from __future__ import annotations
import time
import base64
import logging
import uuid
from pathlib import Path
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
import httpx
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.models import Generation, User
from app.schemas.generation import (
    GenerationCreate,
    GenerationStatus,
    GenerationTaskType,
    AICallbackPayload,
    AICallbackResponse,
)

logger = logging.getLogger(__name__)


def _safe_b64decode(b64_str: str) -> bytes:
    """
    Decodes a Base64 string safely, removing Data URL prefixes (e.g. 'data:image/webp;base64,')
    to prevent garbage header bytes from being prepended to the binary image file.
    """
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    return base64.b64decode(b64_str.strip())


def _detect_image_extension(image_bytes: bytes) -> str:
    """Detect file extension (.png, .jpg, .webp) from binary magic bytes"""
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if image_bytes.startswith(b"RIFF") and len(image_bytes) >= 12 and image_bytes[8:12] == b"WEBP":
        return ".webp"
    return ".png"


# ────────────────────────────────────────
# 1. ดึงงานเดียว (GET /generations/{id})
# ────────────────────────────────────────
def get_generation_by_id(
    db: Session,
    user_id: UUID,
    generation_id: UUID
) -> Optional[Generation]:
    """ดึงข้อมูลงานเดี่ยว พร้อมเช็คสิทธิ์ความเป็นเจ้าของ (Data Isolation)"""
    stmt = select(Generation).where(
        Generation.id == generation_id,
        Generation.user_id == user_id
    )
    generation = db.execute(stmt).scalar_one_or_none()
    
    if generation is None:
        logger.warning(
            f"Access denied or not found | user={user_id} | gen={generation_id}"
        )
    
    return generation


# ────────────────────────────────────────
# 2. ดึงประวัติทั้งหมด (GET /generations)
# ────────────────────────────────────────
def get_user_generations(
    db: Session,
    user_id: UUID,
    page: int = 1,
    page_size: int = 20
) -> tuple[List[Generation], int]:
    """ดึงประวัติงานของ User พร้อม Pagination และเรียงจากใหม่สุดไปเก่าสุด"""
    count_stmt = select(func.count(Generation.id)).where(
        Generation.user_id == user_id
    )
    total = db.execute(count_stmt).scalar() or 0

    offset = (page - 1) * page_size

    items_stmt = (
        select(Generation)
        .where(Generation.user_id == user_id)
        .order_by(Generation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items = list(db.execute(items_stmt).scalars().all())

    return items, total


# ────────────────────────────────────────
# 3. ดึง Path รูปภาพ (GET /generations/{id}/image)
# ────────────────────────────────────────
def get_generation_image_path(
    db: Session,
    user_id: UUID,
    generation_id: UUID
) -> Optional[Path]:
    """คืน Path ของไฟล์ภาพ ถ้างานเสร็จสมบูรณ์และมีไฟล์อยู่จริงบน Disk"""
    stmt = select(Generation).where(
        Generation.id == generation_id,
        Generation.user_id == user_id
    )
    generation = db.execute(stmt).scalar_one_or_none()

    if generation is None:
        logger.warning(
            f"Access denied or not found | user={user_id} | gen={generation_id}"
        )
        return None

    if generation.status != GenerationStatus.COMPLETED.value or not generation.output_path:
        logger.info(
            f"Image not ready yet | user={user_id} | gen={generation_id} | status={generation.status}"
        )
        return None

    file_path = Path(generation.output_path)
    if not file_path.is_file():
        logger.error(
            f"Image file missing on disk | user={user_id} | gen={generation_id} | path={file_path}"
        )
        return None

    return file_path


# ────────────────────────────────────────
# 4. สร้างงานใหม่ (POST /generations)
# ────────────────────────────────────────
def _resolve_storage_path(path_or_url: Optional[str]) -> Optional[str]:
    """แปลง /uploads/filename.png หรือ path สัมพัทธ์ ให้เป็น Path บนระบบไฟล์จริง"""
    if not path_or_url:
        return None
    
    # ถ้าส่งมาเป็น URL เช่น /uploads/xxx.png หรือ http://.../uploads/xxx.png
    filename = Path(path_or_url).name
    candidate_path = Path(settings.UPLOADS_DIR).resolve() / filename
    if candidate_path.is_file():
        return str(candidate_path)
    
    # ถ้าเป็น Path ตรงๆ
    direct_path = Path(path_or_url).resolve()
    if direct_path.is_file():
        return str(direct_path)
    
    return str(candidate_path)


def create_generation_job(
    db: Session,
    user_id: UUID,
    data: GenerationCreate
) -> Generation:
    """สร้าง Record ใหม่ในสถานะ pending พร้อมตรวจสอบความถูกต้องของ task_type"""
    resolved_source_path = _resolve_storage_path(data.source_image_path)
    resolved_mask_path = _resolve_storage_path(data.mask_image_path)

    # ตรวจสอบว่าถ้าเป็น img2img หรือ inpaint ต้องมี source_image_path
    if data.task_type in (GenerationTaskType.IMG2IMG, GenerationTaskType.INPAINT):
        if not data.source_image_path:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"task_type '{data.task_type.value}' requires 'source_image_path'"
            )
        if not Path(resolved_source_path).is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source image file not found on server: {data.source_image_path}"
            )

    new_generation = Generation(
        id=uuid.uuid4(),
        user_id=user_id,
        status=GenerationStatus.PENDING.value,
        task_type=data.task_type.value,
        prompt=data.prompt,
        negative_prompt=data.negative_prompt,
        model_name=data.model_name,
        lora_config=data.lora_config,
        sampler_name=data.sampler_name,
        steps=data.steps,
        cfg_scale=data.cfg_scale,
        seed=data.seed,
        width=data.width,
        height=data.height,
        source_image_path=resolved_source_path,
        mask_image_path=resolved_mask_path,
        denoising_strength=data.denoising_strength,
    )

    db.add(new_generation)
    db.commit()
    db.refresh(new_generation)

    logger.info(
        f"Created new generation job | id={new_generation.id} | user={user_id} | task_type={new_generation.task_type}"
    )
    return new_generation


# ────────────────────────────────────────
# 5. Background Task คุยกับ AI Server (Mode-Aware)
# ────────────────────────────────────────
def _mark_as_failed(
    generation: Generation,
    error_msg: str,
    start_time: float,
    db: Session
) -> None:
    """Helper: อัปเดต status เป็น FAILED พร้อม error_message และ rollback เมื่อเกิดข้อผิดพลาด"""
    generation.status = GenerationStatus.FAILED.value
    generation.error_message = error_msg
    generation.completed_at = datetime.now(timezone.utc)
    generation.duration_seconds = round(time.time() - start_time, 2)

    try:
        db.commit()
    except Exception as db_error:
        db.rollback()
        logger.critical(
            f"Failed to update FAILED status | id={generation.id} | db_err={db_error}"
        )
        return

    logger.error(f"Generation failed | id={generation.id} | error={error_msg}")


async def process_generation_task(
    generation_id: UUID
) -> None:
    """
    Background Task จัดการการส่งงานไปยัง AI Server
    - โหมด Direct: ยิง POST รอรับรูป Base64 ทันที แล้วบันทึกไฟล์เป็น completed
    - โหมด Callback: ยิง POST /ai/generate หรือ /ai/edit ส่ง task_id + callback_url แล้วคงสถานะ processing ไว้รอ Callback
    """
    start_time = time.time()
    db: Session = SessionLocal()

    try:
        # 1. โหลด Generation จาก DB
        stmt = select(Generation).where(Generation.id == generation_id)
        generation = db.execute(stmt).scalar_one_or_none()
        if not generation:
            logger.error(f"Generation job not found in task | id={generation_id}")
            return

        # 2. อัปเดต status เป็น processing
        generation.status = GenerationStatus.PROCESSING.value
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.error(f"Failed to update status to PROCESSING | id={generation_id}")
            return

        logger.info(f"Processing started | id={generation.id} | mode={settings.AI_MODE} | type={generation.task_type}")

        # 3. เตรียม Image Base64 (สำหรับ img2img / inpaint)
        source_b64 = None
        mask_b64 = None

        if generation.task_type in (GenerationTaskType.IMG2IMG.value, GenerationTaskType.INPAINT.value):
            if not generation.source_image_path or not Path(generation.source_image_path).is_file():
                _mark_as_failed(generation, "Missing or invalid source_image_path for img2img/inpaint", start_time, db)
                return
            
            try:
                source_bytes = Path(generation.source_image_path).read_bytes()
                source_b64 = base64.b64encode(source_bytes).decode("utf-8")
            except Exception as e:
                _mark_as_failed(generation, f"Failed to read source image: {e}", start_time, db)
                return

            if generation.mask_image_path and Path(generation.mask_image_path).is_file():
                try:
                    mask_bytes = Path(generation.mask_image_path).read_bytes()
                    mask_b64 = base64.b64encode(mask_bytes).decode("utf-8")
                except Exception as e:
                    logger.warning(f"Could not read mask image: {e}")

        # 4. แยกการทำงานตาม AI_MODE
        if settings.AI_MODE.lower() == "callback":
            # ──────────────────────────────────────────
            # โหมด Callback: ส่งงานไปเข้า Queue ที่ AI Server
            # ──────────────────────────────────────────
            headers = {
                "Content-Type": "application/json",
                "X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET,
            }

            if generation.task_type in (GenerationTaskType.IMG2IMG.value, GenerationTaskType.INPAINT.value):
                edit_endpoint = settings.AI_SERVER_CALLBACK_URL.replace("/ai/generate", "/ai/edit")
                callback_payload = {
                    "task_id": str(generation.id),
                    "prompt": generation.prompt,
                    "image_base64": source_b64,
                    "mask_base64": mask_b64,
                    "mode": "inpaint" if generation.task_type == GenerationTaskType.INPAINT.value else "img2img",
                    "steps": generation.steps,
                    "cfg_scale": generation.cfg_scale,
                    "callback_url": settings.BACKEND_CALLBACK_URL,
                }
                target_url = edit_endpoint
            else:
                callback_payload = {
                    "task_id": str(generation.id),
                    "prompt": generation.prompt,
                    "negative_prompt": generation.negative_prompt,
                    "model": generation.model_name,
                    "lora_config": generation.lora_config,
                    "steps": generation.steps,
                    "cfg_scale": generation.cfg_scale,
                    "width": generation.width,
                    "height": generation.height,
                    "callback_url": settings.BACKEND_CALLBACK_URL,
                }
                target_url = settings.AI_SERVER_CALLBACK_URL

            timeout_config = httpx.Timeout(timeout=30.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                try:
                    logger.info(f"[Callback Mode] Dispatching task to AI Server: {target_url}")
                    res = await client.post(
                        target_url,
                        json=callback_payload,
                        headers=headers
                    )
                    res.raise_for_status()
                    logger.info(f"[Callback Mode] Task successfully queued on AI Server | id={generation.id}")
                except Exception as e:
                    _mark_as_failed(generation, f"Failed to submit task to AI Server: {e}", start_time, db)
            return

        else:
            # ──────────────────────────────────────────
            # โหมด Direct: ยิง POST รอรับรูป Base64 กลับมาทันที
            # ──────────────────────────────────────────
            direct_payload = {
                "task_type": generation.task_type,
                "prompt": generation.prompt,
                "negative_prompt": generation.negative_prompt,
                "steps": generation.steps,
                "cfg_scale": generation.cfg_scale,
                "width": generation.width,
                "height": generation.height,
                "sampler_name": generation.sampler_name,
                "seed": generation.seed,
                "model_name": generation.model_name,
                "lora_config": generation.lora_config,
                "source_image_path": generation.source_image_path,
                "image_base64": source_b64,
                "mask_base64": mask_b64,
                "denoising_strength": generation.denoising_strength,
            }

            target_url = settings.AI_SERVER_DIRECT_URL or settings.AI_SERVER_URL
            timeout_config = httpx.Timeout(timeout=180.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                try:
                    response = await client.post(target_url, json=direct_payload)
                    response.raise_for_status()
                    data = response.json()
                except Exception as e:
                    _mark_as_failed(generation, str(e), start_time, db)
                    return

            if "image_base64" not in data or not data["image_base64"]:
                _mark_as_failed(generation, "AI Server response missing 'image_base64' field", start_time, db)
                return

            try:
                image_data = _safe_b64decode(data["image_base64"])
            except Exception as e:
                _mark_as_failed(generation, f"Invalid base64 image data from AI Server: {e}", start_time, db)
                return

            if not image_data:
                _mark_as_failed(generation, "Decoded image is empty", start_time, db)
                return

            # บันทึกไฟล์ภาพแบบ Atomic Write (แยกโฟลเดอร์ตาม user_id)
            ext = _detect_image_extension(image_data)
            output_dir = (Path(settings.OUTPUTS_DIR).resolve() / str(generation.user_id)) if generation.user_id else Path(settings.OUTPUTS_DIR).resolve()
            output_dir.mkdir(parents=True, exist_ok=True)
            file_path = output_dir / f"{generation.id}{ext}"

            temp_path = file_path.with_suffix(".tmp")
            temp_path.write_bytes(image_data)
            temp_path.replace(file_path)

            # อัปเดต status เป็น completed
            generation.status = GenerationStatus.COMPLETED.value
            generation.output_path = str(file_path.resolve())
            generation.completed_at = datetime.now(timezone.utc)
            generation.duration_seconds = round(time.time() - start_time, 2)

            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.critical(f"Failed to save completed status | id={generation.id} | err={e}")
                return

            logger.info(
                f"[Direct Mode] Generation completed | id={generation.id} | "
                f"duration={generation.duration_seconds}s"
            )

    finally:
        db.close()


# ────────────────────────────────────────
# 6. Service สำหรับจัดการ Callback จาก AI Server
# ────────────────────────────────────────
def process_ai_callback(
    db: Session,
    payload: AICallbackPayload
) -> tuple[int, AICallbackResponse]:
    """
    ประมวลผลผลลัพธ์ที่ AI Server ยิง Callback กลับมา
    - รองรับ Idempotency ป้องกันงานซ้ำ
    - บันทึกภาพลง Disk แบบ Atomic Write
    - อัปเดตสถานะใน Database
    """
    stmt = select(Generation).where(Generation.id == payload.task_id)
    generation = db.execute(stmt).scalar_one_or_none()

    # 1. ไม่พบ Task ในระบบ
    if not generation:
        logger.warning(f"Callback received for unknown task | id={payload.task_id}")
        return 404, AICallbackResponse(
            received=False,
            task_id=payload.task_id,
            status="not_found",
            message="Generation task not found"
        )

    # 2. Idempotency Check: ถ้างาน Completed ไปแล้ว ตอบ 200 ทันที
    if generation.status == GenerationStatus.COMPLETED.value:
        logger.info(f"Duplicate callback ignored for completed task | id={payload.task_id}")
        return 200, AICallbackResponse(
            received=True,
            task_id=payload.task_id,
            status=generation.status,
            duplicate=True,
            message="Task already completed"
        )

    # 3. กรณี AI Server แจ้ง Failed
    if payload.status.lower() == "failed":
        err_msg = payload.error or payload.error_message or "AI generation failed on inference node"
        generation.status = GenerationStatus.FAILED.value
        generation.error_message = err_msg
        generation.completed_at = datetime.now(timezone.utc)
        if payload.generation_time:
            generation.duration_seconds = payload.generation_time
        db.commit()
        logger.error(f"Callback marked task as FAILED | id={payload.task_id} | error={err_msg}")
        return 200, AICallbackResponse(
            received=True,
            task_id=payload.task_id,
            status=GenerationStatus.FAILED.value,
            message=f"Task marked as failed: {err_msg}"
        )

    # 4. กรณี Completed: ตรวจสอบรูปภาพ
    if not payload.image_base64:
        logger.error(f"Callback completed but missing image_base64 | id={payload.task_id}")
        return 422, AICallbackResponse(
            received=False,
            task_id=payload.task_id,
            status="invalid_data",
            message="Missing image_base64 in completed callback"
        )

    try:
        image_data = _safe_b64decode(payload.image_base64)
        if not image_data:
            raise ValueError("Decoded image data is empty")
    except Exception as e:
        logger.error(f"Callback base64 decode failed | id={payload.task_id} | err={e}")
        return 422, AICallbackResponse(
            received=False,
            task_id=payload.task_id,
            status="invalid_data",
            message=f"Invalid base64 image data: {e}"
        )

    # 5. บันทึกไฟล์ภาพแบบ Atomic Write (แยกโฟลเดอร์ตาม user_id)
    ext = _detect_image_extension(image_data)
    output_dir = (Path(settings.OUTPUTS_DIR).resolve() / str(generation.user_id)) if generation.user_id else Path(settings.OUTPUTS_DIR).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    file_path = output_dir / f"{generation.id}{ext}"

    temp_path = file_path.with_suffix(".tmp")
    temp_path.write_bytes(image_data)
    temp_path.replace(file_path)

    # 6. อัปเดตสถานะใน DB เป็น Completed
    generation.status = GenerationStatus.COMPLETED.value
    generation.output_path = str(file_path.resolve())
    generation.completed_at = datetime.now(timezone.utc)
    if payload.generation_time:
        generation.duration_seconds = payload.generation_time
    elif generation.created_at:
        generation.duration_seconds = round(
            (datetime.now(timezone.utc) - generation.created_at).total_seconds(), 2
        )

    db.commit()
    logger.info(f"Callback completed successfully | id={generation.id} | path={file_path}")

    return 200, AICallbackResponse(
        received=True,
        task_id=payload.task_id,
        status=GenerationStatus.COMPLETED.value,
        duplicate=False,
        message="Task completed and image saved successfully"
    )
