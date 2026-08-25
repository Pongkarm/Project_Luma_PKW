from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field

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


# ข้อมูลที่ "รับเข้ามา" ตอนแก้ไขโปรไฟล์ (PATCH /auth/me)
class UserUpdate(BaseModel):
    """
    แก้ไขอีเมลหรือรหัสผ่านของตัวเอง

    current_password บังคับเสมอ แม้จะแก้แค่อีเมล — โทเคนที่หลุดออกไปไม่ควร
    เปลี่ยนรหัสผ่านแล้วล็อกเจ้าของบัญชีออกจากระบบได้
    """
    current_password: str = Field(..., min_length=1)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    new_password: str | None = Field(default=None, min_length=8)
