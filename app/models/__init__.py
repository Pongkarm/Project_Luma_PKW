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