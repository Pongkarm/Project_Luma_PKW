from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdminMeResponse(BaseModel):
    """
    สิ่งที่หน้าบ้านต้องรู้เพื่อวาดแผงให้ถูกต้อง

    ส่งเป็นความสามารถที่ตีความแล้ว ไม่ใช่แค่ชื่อ role ดิบ ๆ เพื่อให้ตรรกะ
    ว่า "role ไหนทำอะไรได้" อยู่ที่เดียวคือฝั่งเซิร์ฟเวอร์
    """

    user_id: UUID
    username: str
    role: str = Field(description="owner | admin | reviewer")
    can_manage_users: bool
    can_view_audit: bool
    can_manage_admins: bool

    model_config = ConfigDict(from_attributes=True)
