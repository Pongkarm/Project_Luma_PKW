import logging
from fastapi import APIRouter, Depends, UploadFile, File, status, Response
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.models import User
from app.schemas.generation import ImageUploadResponse
from app.services import upload as upload_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Image Uploads"])


@router.post(
    "/uploads",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload image for img2img / Inpainting"
)
@router.post(
    "/generations/upload",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Alias: Upload image for img2img"
)
async def upload_image(
    file: UploadFile = File(..., description="ไฟล์รูปภาพ (PNG, JPEG, WEBP ขนาดไม่เกิน 10MB)"),
    current_user: User = Depends(get_current_user),
):
    """
    อัปโหลดไฟล์รูปภาพต้นฉบับหรือ Mask สำหรับใช้งานในโหมด img2img / inpaint
    - ตรวจสอบ Content-Type, Magic Bytes, และ Image Dimensions
    - ป้องกัน Decompression Bomb
    - ลบข้อมูล EXIF เพื่อความเป็นส่วนตัว
    - บันทึกไฟล์แบบ Atomic Write และส่งคืน metadata + URL
    """
    logger.info(f"User '{current_user.username}' uploading file: {file.filename}")
    return await upload_service.save_uploaded_image(file)


@router.get("/uploads/{filename}", summary="Get uploaded static image")
def get_uploaded_image(filename: str):
    """
    ดึงไฟล์รูปภาพที่อัปโหลดไว้ พร้อม Header Cache-Control 24 ชั่วโมง
    """
    file_path = upload_service.get_uploaded_image_path(filename)
    return FileResponse(
        path=file_path,
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.head("/uploads/{filename}", summary="Check if uploaded file exists")
def check_uploaded_image_exists(filename: str):
    """
    ตรวจสอบว่ามีไฟล์รูปภาพนี้อยู่บน Server หรือไม่ (คืน 200 OK หรือ 404 Not Found)
    """
    upload_service.get_uploaded_image_path(filename)
    return Response(status_code=status.HTTP_200_OK)
