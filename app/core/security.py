from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models import User

import bcrypt

# -------------------------------------------------------------
# 1. OAuth2 Scheme
# -------------------------------------------------------------
# กำหนด Scheme สำหรับแกะ Bearer Token ออกจาก Header: "Authorization: Bearer <token>"
# tokenUrl="/auth/login" ใช้ระบุ endpoint ที่ใช้ขอรับ Token เพื่อให้ Swagger UI แสดงปุ่ม Authorize
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# -------------------------------------------------------------
# 2. Password Hashing & Verification (Bcrypt)
# -------------------------------------------------------------
def hash_password(password: str) -> str:
    """แปลง plain text password เป็น bcrypt hash แบบ one-way"""
    # bcrypt มีข้อจำกัดทางสถาปัตยกรรม รองรับความยาวรหัสผ่านสูงสุดไม่เกิน 72 bytes
    # การ truncate ด้วย [:72] ช่วยป้องกันข้อผิดพลาดกรณีผู้ใช้กรอกรหัสผ่านยาวเกินขีดจำกัด
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
    #salt = bcrypt.gensalt() (การเหยาะเกลือ):
    #ถ้าคนสองคนตั้งรหัสว่า 123456 เหมือนกัน ผลลัพธ์ที่ได้จะหน้าตาไม่เหมือนกันเลย เพราะระบบจะสุ่ม "เกลือ" (ตัวอักษรสุ่ม) โรยเข้าไปผสมด้วย ทำให้แฮกเกอร์ใช้ตารางเทียบคำตอบสำเร็จรูป (Rainbow Table) ไม่ได้ผล
    #verify_password:
    #เวลาผู้ใช้ล็อกอิน เราจะไม่ "ถอดรหัส" กลับมา (เพราะ Bcrypt ถอดรหัสกลับไม่ได้ เป็นทางเดินเที่ยวเดียว) แต่เราจะเอารหัสที่ผู้ใช้กรอกใหม่ มาผสมเกลือเดิมแล้วดูว่าผลลัพธ์ตรงกับที่เก็บไว้ไหม


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """ตรวจสอบว่ารหัสผ่านที่ส่งมา ตรงกับ hash ที่เก็บไว้ในฐานข้อมูลหรือไม่"""
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        # bcrypt.checkpw จะดึง Salt จาก hash เดิมมาคำนวณและเทียบค่าแบบ Constant-Time
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        # หาก hash เสียหาย หรือ format ไม่ถูกต้อง ให้คืนค่า False ทันทีโดยไม่ crash
        return False


# -------------------------------------------------------------
# 3. JWT Token Generation & Verification
# -------------------------------------------------------------
def create_access_token(data: dict) -> str:
    """สร้าง JWT Access Token และกำหนดเวลาหมดอายุ"""
    to_encode = data.copy()
    # กำหนดเวลาหมดอายุโดยใช้ timezone.utc เพื่อป้องกันปัญหา Timezone บน server
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # เซ็น Token ด้วย SECRET_KEY และอัลกอริทึมที่กำหนด (เช่น HS256)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict | None:
    """ถอดรหัสและตรวจสอบความถูกต้องของ JWT Token"""
    try:
        # jwt.decode จะตรวจสอบทั้ง Signature และตรวจสอบว่า Token หมดอายุ (exp) แล้วหรือยัง
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        # หาก Signature ไม่ตรง, Token เสีย หรือหมดอายุ จะคืนค่า None
        return None


# -------------------------------------------------------------
# 4. FastAPI Dependency: Current User Authentication
# -------------------------------------------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency สำหรับใช้กับ Protected Endpoints:
    1. ตรวจสอบ JWT Bearer Token
    2. ค้นหา User ในฐานข้อมูล
    3. ตรวจสอบสถานะการใช้งาน (Active/Inactive)
    """
    # เตรียม Exception มาตรฐานสำหรับการ Authentication ล้มเหลว (HTTP 401)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. ถอดรหัส Token
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    # 2. ดึง User Identifier จาก Subject ('sub')
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    # 3. ตรวจสอบ Format ว่าเป็น UUID ที่ถูกต้อง
    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    # 4. Query หาข้อมูลผู้ใช้จากฐานข้อมูล
    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise credentials_exception
        
    # 5. ตรวจสอบว่าบัญชีถูกระงับหรือไม่
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    return user