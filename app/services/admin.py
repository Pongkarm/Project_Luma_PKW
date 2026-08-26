"""
คำถามที่แผงผู้ดูแลระบบถามฐานข้อมูล

ทุกตัวเลขในนี้มาจาก users และ generations ที่มีอยู่แล้ว ไม่มีคอลัมน์ใหม่
ข้อยกเว้นเดียวคือ admin_roles ซึ่งเป็นตารางใหม่ที่ create_all() สร้างให้เอง
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.permissions import Role, get_role
from app.models import AdminRole, AuditEvent, Generation, User

# เพดานฝั่งเซิร์ฟเวอร์ ไม่ให้ ?page_size=100000 ดูดทั้งตารางออกไป
MAX_PAGE_SIZE = 100


def mask_email(email: str) -> str:
    """a•••@example.com — พอให้จำได้ว่าใคร แต่ไม่ใช่ข้อมูลที่เอาไปใช้ต่อได้"""
    name, _, domain = email.partition("@")
    if not domain:
        return "•••"
    head = name[:1] if name else ""
    return f"{head}•••@{domain}"


def _last_generated_subq():
    """
    เวลาที่ผู้ใช้แต่ละคนสร้างภาพครั้งล่าสุด

    ใช้ค่านี้เป็นสัญญาณ "ยังใช้งานอยู่" แทน users.last_login_at เพราะคอลัมน์นั้น
    เพิ่งเริ่มถูกเขียนค่า จึงยังว่างสำหรับทุกคนที่ยังไม่ได้ล็อกอินใหม่ — และ
    สำหรับสินค้าตัวนี้ คนที่ล็อกอินแล้วไม่สร้างอะไรเลยก็ไม่ควรนับว่าใช้งานอยู่
    """
    return (
        select(
            Generation.user_id.label("uid"),
            func.max(Generation.created_at).label("last_at"),
            func.count(Generation.id).label("total"),
            func.sum(case((Generation.status == "failed", 1), else_=0)).label("failed"),
        )
        .group_by(Generation.user_id)
        .subquery()
    )


def list_users(
    db: Session,
    q: str | None = None,
    status_filter: str | None = None,
    active_within_days: int | None = None,
    sort: str = "last_generated",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    page_size = min(page_size, MAX_PAGE_SIZE)
    sub = _last_generated_subq()

    stmt = (
        select(
            User,
            sub.c.last_at,
            func.coalesce(sub.c.total, 0).label("total"),
            func.coalesce(sub.c.failed, 0).label("failed"),
            AdminRole.role,
        )
        .outerjoin(sub, sub.c.uid == User.id)
        .outerjoin(AdminRole, AdminRole.user_id == User.id)
    )

    if q:
        # ค้นชื่อผู้ใช้กับอีเมลพร้อมกัน เพราะไม่มีใครจำได้ว่าตัวเองรู้อันไหน
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(User.username).like(like), func.lower(User.email).like(like))
        )
    if status_filter == "active":
        stmt = stmt.where(User.is_active.is_(True))
    elif status_filter == "disabled":
        stmt = stmt.where(User.is_active.is_(False))

    if active_within_days is not None:
        if active_within_days == 0:
            stmt = stmt.where(sub.c.last_at.is_(None))
        else:
            since = datetime.now(timezone.utc) - timedelta(days=active_within_days)
            stmt = stmt.where(sub.c.last_at >= since)

    total = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()

    order = {
        "last_generated": sub.c.last_at.desc().nullslast(),
        "created": User.created_at.desc(),
        "username": User.username.asc(),
        "generations": func.coalesce(sub.c.total, 0).desc(),
    }.get(sort, sub.c.last_at.desc().nullslast())

    rows = db.execute(
        stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
            "last_generated_at": last_at,
            "generation_count": int(total_ or 0),
            "failure_count": int(failed or 0),
            "admin_role": role,
        }
        for u, last_at, total_, failed, role in rows
    ], total


def get_user_detail(db: Session, user_id: UUID) -> dict | None:
    sub = _last_generated_subq()
    row = db.execute(
        select(
            User,
            sub.c.last_at,
            func.coalesce(sub.c.total, 0),
            func.coalesce(sub.c.failed, 0),
            AdminRole.role,
        )
        .outerjoin(sub, sub.c.uid == User.id)
        .outerjoin(AdminRole, AdminRole.user_id == User.id)
        .where(User.id == user_id)
    ).first()
    if row is None:
        return None
    u, last_at, total_, failed, role = row
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
        "last_generated_at": last_at,
        "generation_count": int(total_ or 0),
        "failure_count": int(failed or 0),
        "admin_role": role,
    }


def list_runs(
    db: Session,
    user_id: UUID | None = None,
    status_filter: str | None = None,
    task_type: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    page_size = min(page_size, MAX_PAGE_SIZE)
    stmt = select(Generation, User.username).join(User, User.id == Generation.user_id)

    if user_id:
        stmt = stmt.where(Generation.user_id == user_id)
    if status_filter:
        stmt = stmt.where(Generation.status == status_filter)
    if task_type:
        stmt = stmt.where(Generation.task_type == task_type)

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(
        stmt.order_by(Generation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return [
        {
            "id": g.id,
            "user_id": g.user_id,
            "username": username,
            "task_type": g.task_type,
            "model_name": g.model_name,
            "width": g.width,
            "height": g.height,
            "status": g.status,
            "error_message": g.error_message,
            "duration_seconds": g.duration_seconds,
            "created_at": g.created_at,
            "prompt": g.prompt,
        }
        for g, username in rows
    ], total


def failure_groups(db: Session, since: datetime, user_id: UUID | None = None, limit: int = 8):
    """
    งานที่ล้มเหลว จัดกลุ่มตามข้อความ เรียงจากที่พบบ่อยที่สุด

    นี่คือแผงที่ทำให้หน้าภาพรวมมีค่า — มันเปลี่ยน "มีบางอย่างผิดพลาด" ให้เป็น
    "งาน 17 ชิ้นล้มด้วยสาเหตุเดียวกัน"
    """
    stmt = (
        select(
            func.coalesce(Generation.error_message, "(ไม่ระบุสาเหตุ)").label("msg"),
            func.count(Generation.id).label("n"),
        )
        .where(Generation.status == "failed", Generation.created_at >= since)
        .group_by("msg")
        .order_by(func.count(Generation.id).desc())
        .limit(limit)
    )
    if user_id:
        stmt = stmt.where(Generation.user_id == user_id)
    return [{"message": m, "count": n} for m, n in db.execute(stmt).all()]


def stats(db: Session, days: int = 14) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    day_ago = now - timedelta(days=1)

    total_users = db.execute(select(func.count(User.id))).scalar_one()
    disabled = db.execute(
        select(func.count(User.id)).where(User.is_active.is_(False))
    ).scalar_one()
    active = db.execute(
        select(func.count(func.distinct(Generation.user_id))).where(
            Generation.created_at >= since
        )
    ).scalar_one()
    gens_24h = db.execute(
        select(func.count(Generation.id)).where(Generation.created_at >= day_ago)
    ).scalar_one()

    done, failed = db.execute(
        select(
            func.sum(case((Generation.status == "completed", 1), else_=0)),
            func.sum(case((Generation.status == "failed", 1), else_=0)),
        ).where(Generation.created_at >= since)
    ).one()
    done, failed = int(done or 0), int(failed or 0)
    finished = done + failed
    success_rate = (done / finished) if finished else 0.0

    median = db.execute(
        select(
            func.percentile_cont(0.5).within_group(Generation.duration_seconds)
        ).where(Generation.status == "completed", Generation.created_at >= since)
    ).scalar_one_or_none()

    per_day = [
        {"day": str(d), "total": int(n)}
        for d, n in db.execute(
            select(
                cast(func.date_trunc("day", Generation.created_at), String).label("d"),
                func.count(Generation.id),
            )
            .where(Generation.created_at >= since)
            .group_by("d")
            .order_by("d")
        ).all()
    ]

    def group(col):
        return [
            {"name": name, "count": int(n)}
            for name, n in db.execute(
                select(col, func.count(Generation.id))
                .where(Generation.created_at >= since)
                .group_by(col)
                .order_by(func.count(Generation.id).desc())
            ).all()
        ]

    return {
        "total_users": total_users,
        "active_users": active,
        "disabled_users": disabled,
        "generations_24h": gens_24h,
        "success_rate": round(success_rate, 4),
        "median_duration_seconds": round(median, 2) if median is not None else None,
        "failures": failure_groups(db, since),
        "per_day": per_day,
        "by_task": group(Generation.task_type),
        "by_model": group(Generation.model_name),
        "window_days": days,
    }


def record_audit(
    db: Session,
    actor_id: UUID,
    action: str,
    target_type: str | None = None,
    target_id: UUID | None = None,
    detail: dict | None = None,
) -> None:
    """
    บันทึกการกระทำลง audit_events

    ตั้งใจไม่ commit ในนี้ ผู้เรียกต้อง commit ครั้งเดียวพร้อมกับการกระทำที่มัน
    บันทึก ถ้าเขียน log ไม่สำเร็จ การกระทำนั้นต้อง rollback ตามไปด้วย —
    ไม่มีทางที่การกระทำจะสำเร็จโดยไม่ทิ้งร่องรอย
    """
    db.add(
        AuditEvent(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
        )
    )


def set_user_active(
    db: Session, actor: User, target_id: UUID, is_active: bool, reason: str
) -> tuple[bool, str | None]:
    """
    ปิดหรือเปิดบัญชี คืน (สำเร็จ, เหตุผลที่ปฏิเสธ)

    การปฏิเสธทั้งสองข้อตรวจที่นี่ ไม่ใช่ที่หน้าจอ หน้าจอแค่บอกล่วงหน้าว่าจะถูก
    ปฏิเสธเพราะอะไร
    """
    target = db.query(User).filter(User.id == target_id).first()
    if target is None:
        return False, "ไม่พบผู้ใช้"

    if target.id == actor.id:
        # ปิดบัญชีตัวเอง = ล็อกตัวเองออกทันที และถ้าเป็น owner คนสุดท้ายก็คือ
        # ล็อกทุกคนออกถาวร
        return False, "ปิดบัญชีของตัวเองไม่ได้"

    target_role = get_role(db, target.id)
    if target_role == Role.OWNER:
        return False, "ปิดบัญชีของเจ้าของระบบไม่ได้"

    if target.is_active == is_active:
        return False, "บัญชีอยู่ในสถานะนี้อยู่แล้ว"

    target.is_active = is_active
    record_audit(
        db,
        actor_id=actor.id,
        action="user.enable" if is_active else "user.disable",
        target_type="user",
        target_id=target.id,
        detail={"reason": reason, "username": target.username},
    )
    db.commit()
    return True, None


def list_audit(
    db: Session, page: int = 1, page_size: int = 25
) -> tuple[list[dict], int]:
    page_size = min(page_size, MAX_PAGE_SIZE)
    actor = aliased(User)
    stmt = select(AuditEvent, actor.username).join(actor, actor.id == AuditEvent.actor_id)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(
        stmt.order_by(AuditEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [
        {
            "id": e.id,
            "actor_id": e.actor_id,
            "actor_username": name,
            "action": e.action,
            "target_type": e.target_type,
            "target_id": e.target_id,
            "detail": e.detail,
            "created_at": e.created_at,
        }
        for e, name in rows
    ], total
