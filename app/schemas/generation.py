from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, computed_field


class GenerationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationTaskType(str, Enum):
    TXT2IMG = "txt2img"
    IMG2IMG = "img2img"
    INPAINT = "inpaint"


class GenerationBase(BaseModel):
    task_type: GenerationTaskType = Field(
        default=GenerationTaskType.TXT2IMG,
        description="ประเภทของงาน (txt2img, img2img, หรือ inpaint)"
    )
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="ข้อความ Prompt ที่ต้องการให้ AI วาด",
        json_schema_extra={"example": "A cute cat wearing astronaut suit in space, digital art, 8k"}
    )
    negative_prompt: str | None = Field(
        default=None,
        max_length=2000,
        description="สิ่งที่ไม่ต้องการให้มีในภาพ",
        json_schema_extra={"example": "ugly, blurry, low quality"}
    )
    model_name: str = Field(
        default="sd-v1-5",
        max_length=100,
        description="ชื่อ Model ที่ใช้"
    )
    lora_config: Dict[str, Any] | None = Field(
        default=None,
        description="การตั้งค่า LoRA"
    )
    sampler_name: str = Field(
        default="Euler a",
        max_length=50,
        description="ชื่อ Sampler Algorithm"
    )
    steps: int = Field(
        default=20,
        ge=1,
        le=150,
        description="จำนวนรอบในการคำนวณ (1 - 150)"
    )
    cfg_scale: float = Field(
        default=7.0,
        ge=0.0,
        le=30.0,
        description="ความเข้มข้นของการทำตาม Prompt (0.0 - 30.0)"
    )
    seed: int | None = Field(
        default=None,
        description="Seed สำหรับการสุ่มภาพ"
    )
    width: int = Field(
        default=512,
        ge=64,
        le=2048,
        description="ความกว้างของภาพ (pixels)"
    )
    height: int = Field(
        default=512,
        ge=64,
        le=2048,
        description="ความสูงของภาพ (pixels)"
    )
    source_image_path: str | None = Field(
        default=None,
        max_length=500,
        description="Path หรือ URL ของภาพต้นฉบับ สำหรับ img2img/inpaint"
    )
    mask_image_path: str | None = Field(
        default=None,
        max_length=500,
        description="Path หรือ URL ของ Mask สำหรับ inpaint"
    )
    denoising_strength: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="ความแรงในการเปลี่ยนภาพเดิม (สำหรับ img2img: 0.0 - 1.0)"
    )


class ImageUploadResponse(BaseModel):
    """Schema ตอบกลับเมื่ออัปโหลดภาพสำเร็จ"""
    file_id: UUID = Field(..., description="ID ประจำไฟล์")
    filename: str = Field(..., description="ชื่อไฟล์ที่บันทึกบน Server")
    url: str = Field(..., description="URL สำหรับดึงไฟล์รูปภาพ")
    width: int = Field(..., description="ความกว้างของภาพ (pixels)")
    height: int = Field(..., description="ความสูงของภาพ (pixels)")
    size_bytes: int = Field(..., description="ขนาดไฟล์ (bytes)")
    format: str = Field(..., description="ฟอร์แมตของภาพ (PNG, JPEG, WEBP)")

    model_config = ConfigDict(from_attributes=True)


class GenerationCreate(GenerationBase):
    """Schema สำหรับรับข้อมูลตอน Client สร้างงานใหม่"""
    pass


class GenerationResponse(GenerationBase):
    """
    Schema สำหรับส่งรายละเอียดงานกลับ Client 
    (Inherit จาก GenerationBase เพื่อให้ Client ได้ดูพารามิเตอร์ที่ใช้ gen ด้วย เช่น prompt, steps)
    """
    id: UUID = Field(..., description="ID ประจำงาน")
    user_id: UUID = Field(..., description="ID ของผู้สร้างงาน")
    status: GenerationStatus = Field(..., description="สถานะปัจจุบันของงาน")
    error_message: str | None = Field(default=None, description="ข้อความ Error หากงานล้มเหลว")
    duration_seconds: float | None = Field(default=None, description="เวลาที่ใช้ประมวลผล (วินาที)")
    created_at: datetime = Field(..., description="เวลาที่สร้างคำสั่ง")
    completed_at: datetime | None = Field(default=None, description="เวลาที่เสร็จสิ้น")

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        if self.status == GenerationStatus.COMPLETED:
            return f"/generations/{self.id}/image"
        return None


class GenerationListResponse(BaseModel):
    """Schema สำหรับส่งรายการประวัติงานสร้างภาพ พร้อม Pagination"""
    items: List[GenerationResponse] = Field(default_factory=list, description="รายการงาน")
    total: int = Field(..., ge=0, description="จำนวนงานทั้งหมด")
    page: int = Field(default=1, ge=1, description="เลขหน้าที่ดูอยู่")
    page_size: int = Field(default=20, ge=1, le=100, description="จำนวนรายการต่อหน้า")

    model_config = ConfigDict(from_attributes=True)


class AICallbackPayload(BaseModel):
    """Schema รับข้อมูล Callback จาก AI Server"""
    task_id: UUID = Field(..., description="ID ประจำ Generation Task")
    status: str = Field(..., description="สถานะจาก AI Server (completed หรือ failed)")
    image_base64: str | None = Field(default=None, description="รูปภาพ Base64")
    error: str | None = Field(default=None, description="ข้อความ Error")
    error_message: str | None = Field(default=None, description="Alias ข้อความ Error")
    generation_time: float | None = Field(default=None, description="เวลาประมวลผล (วินาที)")


class AICallbackResponse(BaseModel):
    """Schema ตอบกลับ AI Server เมื่อรับ Callback สำเร็จ"""
    received: bool = True
    task_id: UUID
    status: str
    duplicate: bool = False
    message: str = "Callback processed successfully"
