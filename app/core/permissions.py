"""
สิทธิ์ของแผงผู้ดูแลระบบ

ระดับสิทธิ์มีสามชั้น ไม่ใช่สี่ เพราะทีมนี้มีงานที่ต่างกันจริงอยู่สามแบบ:
คนที่ตัดสินใจว่าใครเข้าได้, คนที่ดูแลระบบ, และคนที่ตรวจงานโดยไม่แตะอะไร
ระดับที่ไม่มีใครอยู่จริงคือชุด permission ที่ต้องคิดและต้องทดสอบโดยเปล่าประโยชน์
"""

from enum import IntEnum

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models import AdminRole, User


class Role(IntEnum):
    """เรียงจากน้อยไปมาก เพื่อให้เทียบด้วย >= ได้ตรงไปตรงมา"""

    REVIEWER = 1
    ADMIN = 2
    OWNER = 3


ROLE_NAMES = {Role.REVIEWER: "reviewer", Role.ADMIN: "admin", Role.OWNER: "owner"}
NAME_TO_ROLE = {v: k for k, v in ROLE_NAMES.items()}


def get_role(db: Session, user_id) -> Role | None:
    """
    ระดับสิทธิ์ของผู้ใช้คนนี้ หรือ None ถ้าไม่ใช่แอดมิน

    อ่านจากฐานข้อมูลทุกครั้ง ไม่ได้ฝังไว้ใน JWT โดยตั้งใจ — token ถูกเซ็นครั้งเดียว
    แล้วเชื่อจนหมดอายุ ถ้าเก็บ role ไว้ในนั้น คนที่เพิ่งถูกถอดสิทธิ์จะยังใช้อำนาจ
    ได้จนกว่า token จะหมดอายุ ซึ่งตาม .env ที่ deploy อยู่คือ 24 ชั่วโมง
    """
    row = db.query(AdminRole).filter(AdminRole.user_id == user_id).first()
    if row is None:
        return None
    return NAME_TO_ROLE.get(row.role)


def require_role(minimum: Role):
    """
    Dependency สำหรับติดที่ router ไม่ใช่ที่ endpoint ทีละตัว

    ติดที่ router แปลว่า endpoint ที่เพิ่มใหม่จะถูกป้องกันโดยอัตโนมัติ
    การป้องกันควรเป็นค่าเริ่มต้น ไม่ใช่สิ่งที่ต้องจำว่าต้องใส่
    """

    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        role = get_role(db, current_user.id)
        if role is None or role < minimum:
            # 403 ไม่ใช่ 404 ตรงนี้: ผู้ใช้ผ่านการยืนยันตัวตนแล้ว แค่สิทธิ์ไม่ถึง
            # การบอกว่า "ไม่พอ" ไม่ได้เปิดเผยอะไรที่เขาไม่รู้อยู่แล้ว
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"ต้องมีสิทธิ์ระดับ {ROLE_NAMES[minimum]} ขึ้นไป",
            )
        current_user.admin_role = role  # ให้ endpoint อ่านต่อได้โดยไม่ต้อง query ซ้ำ
        return current_user

    return dependency
