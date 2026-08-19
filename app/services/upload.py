"""
Service สำหรับจัดการ Image Upload & Validation
- ตรวจสอบความปลอดภัย 5 ชั้น (Size, Content-Type, Magic Bytes, Decompression Bomb, Dimensions)
- ลบข้อมูลส่วนตัว EXIF (GPS, Metadata) ป้องกันความเป็นส่วนตัว
- บันทึกไฟล์แบบ Atomic Write ในโฟลเดอร์ uploads/ ด้วย UUIDv4
"""
import io
import uuid
import logging
from pathlib import Path
from typing import Tuple
from PIL import Image, UnidentifiedImageError
from fastapi import UploadFile, HTTPException, status

from app.core.config import settings
from app.schemas.generation import ImageUploadResponse

logger = logging.getLogger(__name__)

# 🛡️ ป้องกัน Decompression Bomb Attack ตาม OWASP Guideline
Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_DIMENSION * settings.MAX_IMAGE_DIMENSION

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

def validate_magic_bytes(content: bytes) -> str:
    """
    ตรวจสอบ Magic Bytes ของไฟล์เพื่อยืนยันว่าเป็นไฟล์ภาพจริง
    คืนค่านามสกุลไฟล์ที่ถูกต้อง (.png, .jpg, .webp)
    """
    if len(content) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is too small or corrupted"
        )

    # PNG Signature: 89 50 4E 47 0D 0A 1A 0A
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"

    # JPEG Signature: FF D8 FF
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"

    # WEBP Signature: RIFF....WEBP
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Invalid image signature (Magic bytes mismatch). Only PNG, JPEG, and WEBP are supported."
    )


async def save_uploaded_image(file: UploadFile) -> ImageUploadResponse:
    """
    รับไฟล์จาก Client ผ่านกระบวนการตรวจสอบ 5 ชั้น ลบ EXIF และบันทึกลง Disk แบบ Atomic
    """
    # ──────────────────────────────────────────
    # ชั้นที่ 1: ตรวจสอบ Content-Type Header
    # ──────────────────────────────────────────
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type '{content_type}'. Allowed: image/png, image/jpeg, image/webp"
        )

    # อ่านเนื้อหาไฟล์
    content = await file.read()

    # ──────────────────────────────────────────
    # ชั้นที่ 2: ตรวจสอบขนาดไฟล์ (Max 10MB)
    # ──────────────────────────────────────────
    file_size = len(content)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({round(file_size / (1024*1024), 2)}MB) exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB"
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty"
        )

    # ──────────────────────────────────────────
    # ชั้นที่ 3: ตรวจสอบ Magic Bytes (ไบนารีส่วนหัว)
    # ──────────────────────────────────────────
    ext = validate_magic_bytes(content)

    # ──────────────────────────────────────────
    # ชั้นที่ 4: ตรวจสอบ Decompression Bomb & Dimensions (PIL)
    # ──────────────────────────────────────────
    try:
        image_stream = io.BytesIO(content)
        img = Image.open(image_stream)
        img.load()  # บังคับ decode เพื่อตรวจจับภาพเสีย (Corrupt image)
        width, height = img.size
        img_format = img.format or "PNG"
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image dimensions exceed maximum decompression limit (Decompression Bomb Detected)"
        )
    except (UnidentifiedImageError, Exception) as e:
        logger.warning(f"Image decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Corrupted or invalid image file: {e}"
        )

    if width > settings.MAX_IMAGE_DIMENSION or height > settings.MAX_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image dimensions ({width}x{height}) exceed maximum allowed ({settings.MAX_IMAGE_DIMENSION}x{settings.MAX_IMAGE_DIMENSION})"
        )

    # ──────────────────────────────────────────
    # ชั้นที่ 5: ลบ EXIF Data (GPS / Privacy) & Atomic Write
    # ──────────────────────────────────────────
    file_id = uuid.uuid4()
    filename = f"{file_id}{ext}"
    
    upload_dir = Path(settings.UPLOADS_DIR).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    target_path = upload_dir / filename

    # บันทึกไฟล์ใหม่โดยตัด EXIF metadata ออก
    temp_path = target_path.with_suffix(".tmp")
    try:
        # บันทึกผ่าน PIL เพื่อตัด EXIF ออก
        clean_buffer = io.BytesIO()
        # แปลงโหมดภาพถ้าจำเป็น (เช่น RGBA -> RGB สำหรับ JPEG)
        save_img = img
        if ext == ".jpg" and img.mode in ("RGBA", "P"):
            save_img = img.convert("RGB")
        
        save_img.save(clean_buffer, format=img.format or "PNG")
        temp_path.write_bytes(clean_buffer.getvalue())
        temp_path.replace(target_path)
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        logger.error(f"Failed to write uploaded image | file_id={file_id} | err={e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file to storage"
        )

    logger.info(
        f"Uploaded image saved successfully | id={file_id} | size={file_size}b | "
        f"dim={width}x{height} | file={filename}"
    )

    return ImageUploadResponse(
        file_id=file_id,
        filename=filename,
        url=f"/uploads/{filename}",
        width=width,
        height=height,
        size_bytes=target_path.stat().st_size,
        format=img_format
    )


def get_uploaded_image_path(filename: str) -> Path:
    """
    ตรวจสอบและส่งคืน Path ของไฟล์ในโฟลเดอร์ uploads/ พร้อมป้องกัน Path Traversal
    """
    # Sanitize: ใช้เฉพาะชื่อไฟล์ ตัด path separator ออก
    clean_name = Path(filename).name
    target_path = Path(settings.UPLOADS_DIR).resolve() / clean_name

    if not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found"
        )

    return target_path
