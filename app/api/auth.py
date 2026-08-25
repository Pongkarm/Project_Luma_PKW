import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User, Generation
from app.schemas.user import UserCreate, UserResponse, UserProfileResponse, UserUpdate
from app.schemas.token import Token
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ─────────────────────────────────────────
# 🚪 ประตูที่ 1: สมัครสมาชิก
# ─────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    รับ username, email, password
    → สร้าง user ใหม่ลง database
    → ส่งข้อมูล user กลับไป (ไม่ส่ง password!)
    """

    # 1. เช็กว่า username หรือ email ซ้ำมั้ย?
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username หรือ Email นี้ถูกใช้แล้ว!"
        )

    # 2. แปลง password → hash (เข้ารหัสก่อนเก็บ!)
    hashed_password = hash_password(user_data.password)

    # 3. สร้าง user ใหม่
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
    )

    # 4. บันทึกลง database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 5. ส่งข้อมูลกลับ (response_model จะซ่อน password ให้อัตโนมัติ)
    return new_user


# ─────────────────────────────────────────
# 🚪 ประตูที่ 2: ล็อกอิน
# ─────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    รับ username + password
    → เช็กว่าถูกมั้ย
    → ถ้าถูก ส่ง "กุญแจ" (JWT) กลับไป
    """

    # 1. หา user จาก username หรือ email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()

    # 2. ถ้าไม่เจอ user หรือ password ไม่ถูกต้อง
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username หรือ Password ไม่ถูกต้อง",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. เช็กว่า user ถูกระงับการใช้งานหรือไม่
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="บัญชีนี้ถูกปิดใช้งาน",
        )

    # 4. ถ้าถูก → สร้าง "กุญแจ" (JWT Token)
    access_token = create_access_token(data={"sub": str(user.id)})

    # 5. ส่งกุญแจกลับไป
    return {"access_token": access_token, "token_type": "bearer"}


# ─────────────────────────────────────────
# 🚪 ประตูที่ 3: ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
# ─────────────────────────────────────────
@router.get("/me", response_model=UserProfileResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบันจาก JWT Token
    พร้อมจำนวนประวัติงานทั้งหมด (total_generations) สำหรับแสดงบน Navbar / Profile
    """
    total_gens = (
        db.query(func.count(Generation.id))
        .filter(Generation.user_id == current_user.id)
        .scalar()
        or 0
    )

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        total_generations=total_gens,
    )


# ─────────────────────────────────────────
# 🚪 ประตูที่ 4: แก้ไขอีเมล / รหัสผ่านของตัวเอง
# ─────────────────────────────────────────
@router.patch("/me", response_model=UserProfileResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    แก้ไขอีเมลหรือรหัสผ่าน ต้องยืนยันด้วยรหัสผ่านปัจจุบันเสมอ

    หมายเหตุ: JWT ที่ออกไปแล้วยังใช้ได้จนหมดอายุ ระบบไม่มีบัญชีดำโทเคน
    การเปลี่ยนรหัสผ่านจึงไม่เตะเซสชันอื่นออกทันที
    """
    # 1. ยืนยันตัวตนก่อนแก้อะไรก็ตาม
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสผ่านปัจจุบันไม่ถูกต้อง",
        )

    # 2. ต้องมีอะไรให้แก้จริงๆ
    if payload.username is None and payload.email is None and payload.new_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่มีข้อมูลที่ต้องการแก้ไข",
        )

    # 3. ชื่อผู้ใช้ต้องไม่ซ้ำ — ใช้ล็อกอินได้ จึงต้องไม่ชนกับบัญชีอื่น
    #    (โทเคนผูกกับ user id ไม่ใช่ username เซสชันจึงไม่หลุดตอนเปลี่ยนชื่อ)
    if payload.username is not None and payload.username != current_user.username:
        taken = db.query(User).filter(
            User.username == payload.username,
            User.id != current_user.id,
        ).first()
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username นี้ถูกใช้แล้ว!",
            )
        current_user.username = payload.username

    # 4. อีเมลต้องไม่ซ้ำกับบัญชีอื่น (ซ้ำกับของตัวเองถือว่าไม่เปลี่ยน)
    if payload.email is not None and payload.email != current_user.email:
        taken = db.query(User).filter(
            User.email == payload.email,
            User.id != current_user.id,
        ).first()
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email นี้ถูกใช้แล้ว!",
            )
        current_user.email = payload.email

    if payload.new_password is not None:
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)

    total_gens = (
        db.query(func.count(Generation.id))
        .filter(Generation.user_id == current_user.id)
        .scalar()
        or 0
    )
    logger.info(f"Profile updated | user={current_user.id}")

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        total_generations=total_gens,
    )
