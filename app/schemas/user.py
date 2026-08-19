from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

# ข้อมูลที่ "รับเข้ามา" ตอนสมัคร
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

# ข้อมูลที่ "ส่งออกไป" ให้ user เห็น
class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ข้อมูลโปรไฟล์ User สำหรับ GET /auth/me (สำหรับ Navbar & Profile UI)
class UserProfileResponse(BaseModel):
    id: UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime
    total_generations: int = 0

    model_config = ConfigDict(from_attributes=True)
