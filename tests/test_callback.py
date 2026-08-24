"""
Test Suite: AI Server Callback Endpoint
- POST /api/callback
- Security Secret Validation
- Idempotency & Duplicate Handling
- Atomic Write & DB Updates
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, Generation
from app.core.config import settings


def test_callback_invalid_secret_rejected(client: TestClient):
    """ทดสอบ Callback ด้วย Secret ที่ผิด (403 Forbidden)"""
    payload = {
        "task_id": str(uuid.uuid4()),
        "status": "completed",
        "image_base64": "dummy"
    }
    response = client.post("/api/callback", json=payload, headers={"X-LUMA-INTERNAL-SECRET": "wrong-secret"})
    assert response.status_code == 403


def test_callback_missing_secret_rejected(client: TestClient):
    """ทดสอบ Callback โดยไม่ส่ง Header Secret (403 Forbidden)"""
    payload = {
        "task_id": str(uuid.uuid4()),
        "status": "completed",
        "image_base64": "dummy"
    }
    response = client.post("/api/callback", json=payload)
    assert response.status_code == 403


def test_callback_unknown_task_id(client: TestClient):
    """ทดสอบ Callback สำหรับ Task ID ที่ไม่มีในระบบ (404 Not Found)"""
    fake_id = str(uuid.uuid4())
    payload = {
        "task_id": fake_id,
        "status": "completed",
        "image_base64": "dummy"
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 404
    assert response.json()["received"] is False


def test_callback_success_completed(
    client: TestClient,
    test_user: User,
    sample_image_base64: str,
    db: Session
):
    """ทดสอบ Callback สำเร็จ บันทึกไฟล์ภาพและอัปเดต DB เป็น completed (200 OK)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="beautiful sunset over mountain lake",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="processing"
    )
    db.add(gen)
    db.commit()

    payload = {
        "task_id": str(gen.id),
        "status": "completed",
        "image_base64": sample_image_base64,
        "generation_time": 2.34
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["received"] is True
    assert data["status"] == "completed"
    assert data["duplicate"] is False

    # ตรวจสอบใน DB
    db.refresh(gen)
    assert gen.status == "completed"
    assert gen.output_path is not None
    assert gen.duration_seconds == 2.34


def test_callback_idempotency_duplicate_handling(
    client: TestClient,
    test_user: User,
    sample_image_base64: str,
    db: Session
):
    """
    🔁 Idempotency Test:
    เมื่อ AI Server ยิง Callback ซ้ำสำหรับงานที่ Completed ไปแล้ว
    ระบบต้องตอบ 200 OK พร้อม flag duplicate=True และไม่ error
    """
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="cyberpunk drone",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="completed",
        output_path="/tmp/fake_path.png"
    )
    db.add(gen)
    db.commit()

    payload = {
        "task_id": str(gen.id),
        "status": "completed",
        "image_base64": sample_image_base64
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["received"] is True
    assert data["duplicate"] is True


def test_callback_failed_status_handling(
    client: TestClient,
    test_user: User,
    db: Session
):
    """ทดสอบ Callback แจ้งสถานะ Failed พร้อมบันทึก error_message ลง DB"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="failing prompt",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="processing"
    )
    db.add(gen)
    db.commit()

    payload = {
        "task_id": str(gen.id),
        "status": "failed",
        "error": "CUDA Out of Memory (OOM)",
        "generation_time": 1.1
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"

    db.refresh(gen)
    assert gen.status == "failed"
    assert "CUDA Out of Memory" in gen.error_message


def test_callback_missing_image_on_completed(
    client: TestClient,
    test_user: User,
    db: Session
):
    """ทดสอบ Callback ส่ง completed แต่ไม่มีรูปภาพ base64 (422 Unprocessable Entity)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="no image test",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="processing"
    )
    db.add(gen)
    db.commit()

    payload = {
        "task_id": str(gen.id),
        "status": "completed",
        "image_base64": None
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 422


def test_callback_data_url_prefix_webp_stripped_properly(
    client: TestClient,
    test_user: User,
    sample_image_base64: str,
    db: Session
):
    """
    ทดสอบว่า Callback ที่มี Data URL Prefix (เช่น data:image/webp;base64,...)
    จะถูกตัด Prefix ออกอย่างถูกต้อง ไม่เกิด 15 ไบต์ขยะที่หัวไฟล์ และเปิดด้วย PIL ได้สมบูรณ์
    """
    from PIL import Image

    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="webp data url test",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="processing"
    )
    db.add(gen)
    db.commit()

    # Prepend Data URL prefix
    data_url_payload = f"data:image/webp;base64,{sample_image_base64}"

    payload = {
        "task_id": str(gen.id),
        "status": "completed",
        "image_base64": data_url_payload,
        "generation_time": 1.5
    }
    headers = {"X-LUMA-INTERNAL-SECRET": settings.AI_CALLBACK_SECRET}
    response = client.post("/api/callback", json=payload, headers=headers)
    assert response.status_code == 200

    db.refresh(gen)
    assert gen.status == "completed"
    assert gen.output_path is not None

    # ตรวจสอบว่าไฟล์เปิดด้วย PIL ได้ ไม่โยน UnidentifiedImageError
    with Image.open(gen.output_path) as img:
        img.verify()

