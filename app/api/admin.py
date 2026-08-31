"""
แผงผู้ดูแลระบบ

ทุก endpoint ในไฟล์นี้อยู่หลัง require_role ที่ติดไว้ระดับ router
การพิมพ์ URL ตรง ๆ จึงถูกปฏิเสธจากฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่หน้าจอไม่ยอมวาด

reviewer เห็นน้อยกว่า admin สองอย่างโดยตั้งใจ: อีเมลถูกปิดบัง และคำสั่งสร้างภาพ
ถูกซ่อน เพราะ prompt เป็นข้อความที่ผู้ใช้เขียนเอง จึงเป็นข้อมูลส่วนตัวที่สุด
ในฐานข้อมูลนี้ การซ่อนเกิดขึ้นฝั่งเซิร์ฟเวอร์ — ไม่ได้ส่งไปแล้วให้หน้าบ้านไม่วาด
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_NAMES, Role, get_role, require_role
from app.db.database import get_db
from app.models import User
from app.schemas.admin import (
    AdminMeResponse,
    AuditListResponse,
    AdminRunListResponse,
    AdminStatsResponse,
    AdminUserDetail,
    AdminRoleRow,
    AdminUserListResponse,
    RoleAssign,
    UserStatusUpdate,
)
from app.services import admin as svc

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role(Role.REVIEWER))],
)


def _redact(rows: list[dict], role: Role, *, is_run: bool) -> list[dict]:
    """ตัดสิ่งที่ระดับสิทธิ์นี้ไม่ควรเห็นออกก่อนส่ง"""
    if role >= Role.ADMIN:
        return rows
    for r in rows:
        if is_run:
            r["prompt"] = None
        else:
            r["email"] = svc.mask_email(r["email"])
    return rows


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


@router.get("/stats", response_model=AdminStatsResponse)
def read_stats(
    days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.REVIEWER)),
):
    """ตัวเลขทั้งหน้าภาพรวมในคำขอเดียว — ตัวเลขรวม ไม่มีชื่อหรืออีเมลใคร"""
    return svc.stats(db, days=days)


@router.get("/users", response_model=AdminUserListResponse)
def read_users(
    q: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    active_within: int | None = Query(None, ge=0, le=365),
    sort: str = "last_generated",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.REVIEWER)),
):
    items, total = svc.list_users(
        db, q=q, status_filter=status_filter, active_within_days=active_within,
        sort=sort, page=page, page_size=page_size,
    )
    role = get_role(db, current_user.id)
    return AdminUserListResponse(
        items=_redact(items, role, is_run=False),
        total=total, page=page, page_size=min(page_size, svc.MAX_PAGE_SIZE),
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def read_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.REVIEWER)),
):
    detail = svc.get_user_detail(db, user_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบผู้ใช้")

    role = get_role(db, current_user.id)
    runs, _total = svc.list_runs(db, user_id=user_id, page_size=10)
    return AdminUserDetail(
        user=_redact([detail], role, is_run=False)[0],
        recent_runs=_redact(runs, role, is_run=True),
        failures=svc.failure_groups(
            db, datetime.now(timezone.utc) - timedelta(days=30), user_id=user_id
        ),
    )


@router.get("/generations", response_model=AdminRunListResponse)
def read_generations(
    user_id: UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    task_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.REVIEWER)),
):
    items, total = svc.list_runs(
        db, user_id=user_id, status_filter=status_filter,
        task_type=task_type, page=page, page_size=page_size,
    )
    role = get_role(db, current_user.id)
    return AdminRunListResponse(
        items=_redact(items, role, is_run=True),
        total=total, page=page, page_size=min(page_size, svc.MAX_PAGE_SIZE),
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserDetail)
def set_user_status(
    user_id: UUID,
    body: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMIN)),
):
    """
    ปิดหรือเปิดบัญชี — การกระทำเดียวที่แอดมินทำกับบัญชีคนอื่นได้

    ตั้งใจไม่มี endpoint สำหรับเปลี่ยนอีเมลหรือรหัสผ่านของผู้ใช้ นั่นดูเหมือน
    ฟีเจอร์ที่ช่วยเหลือ แต่จริง ๆ คือเส้นทางยึดบัญชี: เปลี่ยนอีเมลแล้วขอรีเซ็ตรหัส
    """
    ok, refusal = svc.set_user_active(db, current_user, user_id, body.is_active, body.reason)
    if not ok:
        if refusal == "ไม่พบผู้ใช้":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=refusal)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=refusal)

    detail = svc.get_user_detail(db, user_id)
    role = get_role(db, current_user.id)
    runs, _ = svc.list_runs(db, user_id=user_id, page_size=10)
    return AdminUserDetail(
        user=_redact([detail], role, is_run=False)[0],
        recent_runs=_redact(runs, role, is_run=True),
        failures=svc.failure_groups(
            db, datetime.now(timezone.utc) - timedelta(days=30), user_id=user_id
        ),
    )


@router.get("/audit", response_model=AuditListResponse)
def read_audit(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    """
    ไทม์ไลน์การกระทำของแอดมิน

    อ่านอย่างเดียวโดยโครงสร้าง ไม่มี route ไหนแก้หรือลบแถวในตารางนี้เลย
    log ที่แอดมินแก้ได้ไม่ใช่หลักฐานอะไรทั้งนั้น
    """
    items, total = svc.list_audit(db, page=page, page_size=page_size)
    return AuditListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/roles", response_model=list[AdminRoleRow])
def read_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.OWNER)),
):
    """ใครถืออำนาจอยู่บ้าง หน้าเล็กแต่เดิมพันสูง"""
    return svc.list_admins(db)


@router.post("/roles", status_code=status.HTTP_204_NO_CONTENT)
def assign_role(
    body: RoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.OWNER)),
):
    """
    มอบหรือเปลี่ยนระดับสิทธิ์ให้ผู้ใช้ที่สมัครไว้แล้วเท่านั้น

    ตั้งใจรับ user_id ไม่ใช่อีเมลเป็นข้อความ — มอบอำนาจให้คนที่ยังไม่มีตัวตน
    ไม่ได้ และการพิมพ์อีเมลผิดคือการเปิดประตูทิ้งไว้เงียบ ๆ
    """
    ok, refusal = svc.set_admin_role(db, current_user, body.user_id, body.role)
    if not ok:
        code = status.HTTP_404_NOT_FOUND if refusal == "ไม่พบผู้ใช้" else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail=refusal)


@router.delete("/roles/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_role(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.OWNER)),
):
    ok, refusal = svc.set_admin_role(db, current_user, user_id, None)
    if not ok:
        code = status.HTTP_404_NOT_FOUND if refusal == "ไม่พบผู้ใช้" else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail=refusal)
