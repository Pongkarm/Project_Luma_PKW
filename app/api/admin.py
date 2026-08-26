"""
แผงผู้ดูแลระบบ

ทุก endpoint ในไฟล์นี้อยู่หลัง require_role ที่ติดไว้ระดับ router
การพิมพ์ URL ตรง ๆ จึงถูกปฏิเสธจากฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่หน้าจอไม่ยอมวาด
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_NAMES, Role, get_role, require_role
from app.db.database import get_db
from app.models import User
from app.schemas.admin import AdminMeResponse

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role(Role.REVIEWER))],
)


@router.get("/me", response_model=AdminMeResponse)
def read_admin_me(
    current_user: User = Depends(require_role(Role.REVIEWER)),
    db: Session = Depends(get_db),
):
    """
    สิทธิ์ของแอดมินที่เรียกมา — เป็นตัวขับหน้าตาทั้งแผง

    หน้าบ้านใช้ค่านี้ตัดสินว่าจะแสดงเมนูอะไรและปุ่มไหนกดได้ แต่การซ่อนปุ่ม
    ไม่ใช่การป้องกัน endpoint แต่ละตัวยังตรวจสิทธิ์ของตัวเองเสมอ
    """
    role = get_role(db, current_user.id)
    return AdminMeResponse(
        user_id=current_user.id,
        username=current_user.username,
        role=ROLE_NAMES[role],
        can_manage_users=role >= Role.ADMIN,
        can_view_audit=role >= Role.ADMIN,
        can_manage_admins=role >= Role.OWNER,
    )
