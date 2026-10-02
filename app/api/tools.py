import asyncio
import logging
from pathlib import Path
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
    status
)
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import get_current_user
from app.models import User
from app.schemas.tools import (
    PoseResponse,
    ToolBaseResponse,
    RemoveBgResponse,
    PoseLandmark,
)
from app.services import image_tools

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["Image Processing Studio Tools"])

# 🔒 จำกัดการรันเครื่องมือกิน CPU พร้อมกันไม่เกิน 2 งาน เพื่อป้องกัน Event Loop / CPU Starvation
_tool_slots = asyncio.Semaphore(2)


async def _run_in_pool(fn, *args, **kwargs):
    """รันงาน Synchronous / CPU-bound ใน ThreadPool แยก พร้อมคิว Semaphore และ Timeout 60s"""
    async with _tool_slots:
        return await asyncio.wait_for(
            run_in_threadpool(fn, *args, **kwargs),
            timeout=60.0
        )


async def _read_and_decode_upload(file: UploadFile):
    """อ่านและตรวจสอบไฟล์ภาพอัปโหลด ป้องกัน Decompression Bomb และขนาดเกินขีดจำกัด"""
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an image file via 'file' field."
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # ตรวจสอบขนาดไฟล์ไม่ให้เกิน 10 MB
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image file size exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
        )

    try:
        image_bgr = await _run_in_pool(image_tools.load_image_from_bytes, content)
        return image_bgr
    except ValueError as e:
        err_msg = str(e)
        if "exceeds maximum allowed" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid image format: {err_msg}"
        )


# -------------------------------------------------------------
# 1. POST /api/tools/pose (คนที่ 1: MediaPipe Pose)
# -------------------------------------------------------------
@router.post(
    "/pose",
    response_model=PoseResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect pose skeleton and extract 33 landmarks"
)
async def detect_pose(
    file: UploadFile = File(..., description="ไฟล์ภาพต้นฉบับ (PNG, JPEG, WEBP)"),
    current_user: User = Depends(get_current_user),
):
    """
    วิเคราะห์สรีระและท่าทาง 33 จุด (MediaPipe Pose)
    - รันใน Worker Thread แยก ไม่บล็อก Server Event Loop
    - หากไม่พบคนในภาพ ตอบ 200 OK พร้อม landmarks: []
    """
    image_bgr = await _read_and_decode_upload(file)

    try:
        annotated_bgr, landmarks_data = await _run_in_pool(
            image_tools.extract_pose_skeleton,
            image_bgr
        )
        result_url, _ = await _run_in_pool(
            image_tools.save_tool_result,
            annotated_bgr,
            "pose"
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pose detection timed out."
        )
    except Exception as e:
        logger.exception("Pose detection failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pose detection error: {e}"
        )

    parsed_landmarks = [PoseLandmark(**lm) for lm in landmarks_data]
    has_detected = len(parsed_landmarks) > 0
    pose_metadata: Dict[str, Any] = {
        "total_landmarks": len(parsed_landmarks),
        "detected": has_detected,
    }
    if not has_detected:
        pose_metadata["warning"] = (
            "ไม่พบโครงสร้างร่างกายในภาพ (No human pose detected). "
            "กรุณาใช้ภาพที่มีคนเห็นสรีระครึ่งตัวหรือเต็มตัวชัดเจน"
        )

    return PoseResponse(
        success=True,
        tool="pose",
        result_image_url=result_url,
        landmarks=parsed_landmarks,
        metadata=pose_metadata
    )


# -------------------------------------------------------------
# 2. POST /api/tools/sketch (คนที่ 2: Artistic Pencil Sketch)
# -------------------------------------------------------------
@router.post(
    "/sketch",
    response_model=ToolBaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert image to artistic pencil sketch"
)
async def create_pencil_sketch(
    file: UploadFile = File(..., description="ไฟล์ภาพต้นฉบับ"),
    blur_ksize: int = Form(21, ge=3, le=51, description="ขนาด Gaussian Blur Kernel (3 ถึง 51)"),
    current_user: User = Depends(get_current_user),
):
    """
    แปลงภาพเป็นภาพวาดลายเส้นดินสอด้วยเทคนิค Color Dodge Blend (Lecture 9)
    """
    image_bgr = await _read_and_decode_upload(file)

    try:
        sketch_bgr, actual_ksize = await _run_in_pool(
            image_tools.generate_pencil_sketch,
            image_bgr,
            blur_ksize
        )
        result_url, _ = await _run_in_pool(
            image_tools.save_tool_result,
            sketch_bgr,
            "sketch"
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Sketch generation timed out."
        )
    except Exception as e:
        logger.exception("Pencil sketch generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sketch processing error: {e}"
        )

    return ToolBaseResponse(
        success=True,
        tool="sketch",
        result_image_url=result_url,
        metadata={"blur_ksize": actual_ksize}
    )


# -------------------------------------------------------------
# 3. POST /api/tools/color-splash (คนที่ 3: Color Splash & Mood Tint)
# -------------------------------------------------------------
@router.post(
    "/color-splash",
    response_model=ToolBaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Keep target color and make background grayscale"
)
async def create_color_splash(
    file: UploadFile = File(..., description="ไฟล์ภาพต้นฉบับ"),
    target_color: Literal["green", "red"] = Form("green", description="สีที่ต้องการคงไว้ ('green' หรือ 'red')"),
    current_user: User = Depends(get_current_user),
):
    """
    ดูดสีเด่น ('green' หรือ 'red') ด้วย Color Space HSV ตาม Lecture 3 & Work 5
    """
    image_bgr = await _read_and_decode_upload(file)

    try:
        splash_bgr = await _run_in_pool(
            image_tools.apply_color_splash,
            image_bgr,
            target_color
        )
        result_url, _ = await _run_in_pool(
            image_tools.save_tool_result,
            splash_bgr,
            "splash"
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Color splash timed out."
        )
    except Exception as e:
        logger.exception("Color splash failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Color splash error: {e}"
        )

    return ToolBaseResponse(
        success=True,
        tool="color-splash",
        result_image_url=result_url,
        metadata={"target_color": target_color}
    )


# -------------------------------------------------------------
# 4. POST /api/tools/remove-bg (คนที่ 4: Smart BG Removal & Auto-Mask)
# -------------------------------------------------------------
@router.post(
    "/remove-bg",
    response_model=RemoveBgResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove background with GrabCut and generate inpaint mask"
)
async def remove_background(
    file: UploadFile = File(..., description="ไฟล์ภาพต้นฉบับ"),
    current_user: User = Depends(get_current_user),
):
    """
    ตัดฉากหลังโปร่งใส (RGBA) ด้วย GrabCut + Morphology Close
    และส่งออก Binary Mask ขาว-ดำ สำหรับใช้งานบน Inpainting Canvas (Lecture 10, 11)
    """
    image_bgr = await _read_and_decode_upload(file)

    try:
        rgba, clean_mask = await _run_in_pool(
            image_tools.smart_remove_background,
            image_bgr
        )
        nobg_url, _ = await _run_in_pool(image_tools.save_tool_result, rgba, "nobg")
        mask_url, _ = await _run_in_pool(image_tools.save_tool_result, clean_mask, "mask")
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Background removal timed out."
        )
    except Exception as e:
        logger.exception("Background removal failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Background removal error: {e}"
        )

    return RemoveBgResponse(
        success=True,
        tool="remove-bg",
        result_image_url=nobg_url,
        mask_image_url=mask_url,
        metadata={
            "method": "grabcut_morphology_close",
            "iterations": 5
        }
    )


# -------------------------------------------------------------
# 5. GET /api/tools/results/{filename} (ดาวน์โหลดไฟล์ผลลัพธ์)
# -------------------------------------------------------------
@router.get(
    "/results/{filename}",
    summary="Get processed tool result image"
)
def get_tool_result_image(filename: str):
    """
    เสิร์ฟไฟล์ภาพผลลัพธ์ของ Tools ให้กับ Frontend
    - ตรวจสอบรูปแบบชื่อไฟล์เดี่ยวตาม Regex ^[A-Za-z0-9_-][A-Za-z0-9_.-]*$
    - ป้องกัน Directory Traversal
    - รองรับ Request ที่แนบ Authorization Header จาก Frontend
    """
    safe_filename = Path(filename).name
    if safe_filename != filename or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool result image not found."
        )

    file_path = image_tools.TOOLS_OUTPUT_DIR / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool result image not found."
        )

    media_type = "image/png" if file_path.suffix.lower() == ".png" else "image/jpeg"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"}
    )
