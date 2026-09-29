import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    BigInteger,
    Float,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

#ทำไมระบบนี้ไม่ใช้เลขรหัสอัตโนมัติ 1, 2, 3, 4 แต่ใช้ UUIDv4 ยาวๆ แทน?
#ถ้าเรารันเลขไอดีภาพเป็น 1, 2, 3... แฮกเกอร์จะรู้ทันทีว่าเขาสามารถสุ่มเปลี่ยน URL 
#เป็น GET /generations/4, GET /generations/5 เพื่อแอบดูภาพของคนอื่นในระบบได้ (เรียกว่าช่องโหว่ IDOR)
#ระบบ LUMA จึงใช้ UUIDv4 เช่น e2b1b369-1c88-4e89-a299-1a5c6d35702d 
# ซึ่งเป็นเลขสุ่มทางคณิตศาสตร์ 128 บิต โอกาสที่ใครจะเดาถูกมีค่าน้อยกว่าโอกาสถูกหวยรางวัลที่หนึ่งติดต่อกันสิบงวดเสียอีก!

class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    generations = relationship("Generation", back_populates="user", cascade="all, delete-orphan")


class Generation(Base):

    '''เก็บประวัติการเดินทางของรูปภาพ 1 รูปอย่างครบถ้วน'''

    __tablename__ = "generations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    task_type = Column(String(20), nullable=False)
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    model_name = Column(String(100), nullable=False)
    lora_config = Column(JSON, nullable=True)
    sampler_name = Column(String(50), nullable=False)
    steps = Column(Integer, nullable=False)
    cfg_scale = Column(Float, nullable=False)
    seed = Column(BigInteger, nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)

    source_image_path = Column(String(500), nullable=True)
    mask_image_path = Column(String(500), nullable=True)
    denoising_strength = Column(Float, nullable=True)
    output_path = Column(String(500), nullable=True)

    status = Column(String(20), default="pending", nullable=False)
    error_message = Column(Text, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="generations")


class AdminRole(Base):
    """
    ใครเป็นผู้ดูแลระบบ และในระดับไหน

    เก็บเป็นตารางแยก ไม่ใช่คอลัมน์ใน users เพราะ create_all() สร้างตารางใหม่ให้เอง
    แต่ไม่เคยสั่ง ALTER TABLE — คอลัมน์ใหม่จึงต้องรัน SQL มือบนฐานข้อมูลจริง
    ส่วนตารางใหม่แค่ pull แล้ว restart

    การไม่มีแถว = ไม่ใช่แอดมิน ซึ่งเป็นค่าเริ่มต้นที่ปลอดภัย
    """

    __tablename__ = "admin_roles"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role = Column(String(20), nullable=False)  # owner | admin | reviewer
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])


class AuditEvent(Base):
    """
    บันทึกทุกการกระทำของแอดมินที่เปลี่ยนสถานะระบบ

    เขียนใน transaction เดียวกับการกระทำที่มันบันทึก ถ้าเขียน log ไม่สำเร็จ
    การกระทำนั้นต้อง rollback ตามไปด้วย — ไม่มีทางที่การกระทำจะสำเร็จโดยไม่มีร่องรอย

    ไม่มี route ไหนแก้หรือลบแถวในตารางนี้ log 
    
    เมื่อแอดมินกดแบนผู้ใช้, สั่งลบรูป หรือแต่งตั้งใครเป็นแอดมินใหม่ ทุกการกระทำจะถูกจารึกลงในตารางนี้

    """

    __tablename__ = "audit_events"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)
    target_type = Column(String(30), nullable=True)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_id])
