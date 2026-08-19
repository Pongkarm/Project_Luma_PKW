from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas.generation import (
    GenerationCreate,
    GenerationResponse,
    GenerationListResponse,
)
from app.services import generation as generation_service

router = APIRouter(prefix="/generations", tags=["Generations"])


# ─────────────────────────────────────────
# 1. POST /generations (สร้างงานใหม่)
# ─────────────────────────────────────────
@router.post("", response_model=GenerationResponse, status_code=status.HTTP_201_CREATED)
def create_generation(
    data: GenerationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    สร้างงานภาพใหม่ในสถานะ pending และส่งต่องานให้ Background Task ทำงานกับ AI Server
    """
    # 1. สร้าง Record งานใหม่ใน Database
    new_job = generation_service.create_generation_job(
        db=db,
        user_id=current_user.id,
        data=data,
    )

    # 2. เพิ่ม Task เข้า Background Worker (ส่ง generation_id ไปรันแยก session)
    background_tasks.add_task(
        generation_service.process_generation_task,
        generation_id=new_job.id,
    )

    # 3. แปลงเป็น Response Schema อย่างชัดเจนและตอบกลับทันที
    return GenerationResponse.model_validate(new_job)


# ─────────────────────────────────────────
# 2. GET /generations (ดึงประวัติทั้งหมด)
# ─────────────────────────────────────────
@router.get("", response_model=GenerationListResponse)
def list_generations(
    page: int = Query(default=1, ge=1, description="หน้าที่ต้องการดู"),
    page_size: int = Query(default=20, ge=1, le=100, description="จำนวนรายการต่อหน้า"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    ดึงประวัติรายการงานสร้างภาพทั้งหมดของ User ปัจจุบัน พร้อม Pagination
    """
    items, total = generation_service.get_user_generations(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )

    response_items = [GenerationResponse.model_validate(item) for item in items]
    return GenerationListResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ─────────────────────────────────────────
# 3. GET /generations/{generation_id} (ดึงงานเดียว)
# ─────────────────────────────────────────
@router.get("/{generation_id}", response_model=GenerationResponse)
def get_generation(
    generation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    ดูสถานะและรายละเอียดของงานสร้างภาพชิ้นเดียว
    """
    generation = generation_service.get_generation_by_id(
        db=db,
        user_id=current_user.id,
        generation_id=generation_id,
    )

    if generation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation job not found",
        )

    return GenerationResponse.model_validate(generation)


# ─────────────────────────────────────────
# 4. GET /generations/{generation_id}/image (ดาวน์โหลดภาพ)
# ─────────────────────────────────────────
@router.get("/{generation_id}/image")
def get_generation_image(
    generation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    ดาวน์โหลดไฟล์ภาพที่ประมวลผลเสร็จแล้ว
    """
    file_path = generation_service.get_generation_image_path(
        db=db,
        user_id=current_user.id,
        generation_id=generation_id,
    )

    if file_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or not ready yet",
        )

    return FileResponse(
        path=file_path,
        media_type="image/png",
        filename=f"{generation_id}.png",
    )
