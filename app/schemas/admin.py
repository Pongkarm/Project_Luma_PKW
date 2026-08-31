from datetime import datetime
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


class FailureGroup(BaseModel):
    """งานที่ล้มเหลวด้วยสาเหตุเดียวกัน จัดกลุ่มแล้วนับ"""

    message: str
    count: int


class DayPoint(BaseModel):
    day: str
    total: int


class NamedCount(BaseModel):
    name: str
    count: int


class AdminStatsResponse(BaseModel):
    """
    ตัวเลขหกตัวสำหรับหน้าภาพรวม บวกสองแผงที่ทำให้ตัวเลขนั้นมีความหมาย

    ประกอบมาให้ในคำขอเดียว เพราะการยิงหกครั้งเพื่อวาดหน้าเดียวแย่กว่า
    การ query ครั้งเดียวที่ทำ aggregate หกอย่าง
    """

    total_users: int
    active_users: int = Field(description="สร้างภาพอย่างน้อยหนึ่งครั้งในช่วงที่กำหนด")
    disabled_users: int
    generations_24h: int
    success_rate: float = Field(description="สัดส่วนงานที่สำเร็จในช่วงที่กำหนด 0-1")
    median_duration_seconds: float | None

    failures: list[FailureGroup]
    per_day: list[DayPoint]
    by_task: list[NamedCount]
    by_model: list[NamedCount]

    window_days: int


class AdminUserRow(BaseModel):
    """หนึ่งแถวในตารางผู้ใช้ — ไม่มี password_hash อยู่ใน schema เลย ไม่ใช่กรองออกทีหลัง"""

    id: UUID
    username: str
    email: str = Field(description="ถูกปิดบังบางส่วนสำหรับ reviewer")
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    last_generated_at: datetime | None
    generation_count: int
    failure_count: int
    admin_role: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    """รูปแบบเดียวกับ GenerationListResponse เพื่อให้หน้าบ้านใช้ hook เดิมได้"""

    items: list[AdminUserRow] = Field(default_factory=list)
    total: int
    page: int
    page_size: int


class AdminRunRow(BaseModel):
    id: UUID
    user_id: UUID
    username: str
    task_type: str
    model_name: str
    width: int
    height: int
    status: str
    error_message: str | None
    duration_seconds: float | None
    created_at: datetime
    prompt: str | None = Field(default=None, description="ซ่อนจาก reviewer")

    model_config = ConfigDict(from_attributes=True)


class AdminRunListResponse(BaseModel):
    items: list[AdminRunRow] = Field(default_factory=list)
    total: int
    page: int
    page_size: int


class AdminUserDetail(BaseModel):
    user: AdminUserRow
    recent_runs: list[AdminRunRow]
    failures: list[FailureGroup]


class UserStatusUpdate(BaseModel):
    """
    เหตุผลเป็นฟิลด์บังคับ ไม่ใช่พิธีกรรม — มันคือสิ่งที่ทำให้ audit log อ่านรู้เรื่อง
    ในอีกสามสัปดาห์ และการต้องพิมพ์คือจังหวะหยุดที่กันการกดพลาด
    """

    is_active: bool
    reason: str = Field(min_length=3, max_length=200)


class AuditRow(BaseModel):
    id: UUID
    actor_id: UUID
    actor_username: str
    action: str
    target_type: str | None
    target_id: UUID | None
    detail: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditListResponse(BaseModel):
    items: list[AuditRow] = Field(default_factory=list)
    total: int
    page: int
    page_size: int


class AdminRoleRow(BaseModel):
    user_id: UUID
    username: str
    email: str
    role: str
    granted_by_username: str | None
    granted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleAssign(BaseModel):
    user_id: UUID
    role: str = Field(description="owner | admin | reviewer")
