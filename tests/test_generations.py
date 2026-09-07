"""
Test Suite: Generation Endpoints & Data Isolation
- POST /generations
- GET /generations
- GET /generations/{id}
- GET /generations/{id}/image
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from datetime import datetime, timezone, timedelta
from app.models import User, Generation
from app.schemas.generation import GenerationStatus


def test_create_generation_job_success(client: TestClient, auth_headers: dict):
    """ทดสอบสร้างงานใหม่สำเร็จ คืน 201 พร้อม status=pending"""
    payload = {
        "prompt": "a cute orange cat wearing sunglasses on the beach",
        "task_type": "txt2img",
        "model_name": "counterfeitV30_v30.safetensors",
        "width": 512,
        "height": 512,
        "steps": 25,
        "cfg_scale": 7.5
    }
    response = client.post("/generations", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["prompt"] == payload["prompt"]
    assert data["status"] == GenerationStatus.PENDING.value
    assert "id" in data
    assert "user_id" in data


def test_create_generation_unauthorized(client: TestClient):
    """ทดสอบสร้างงานโดยไม่มีสิทธิ์ (401 Unauthorized)"""
    payload = {"prompt": "test prompt", "task_type": "txt2img"}
    response = client.post("/generations", json=payload)
    assert response.status_code == 401


def test_create_generation_empty_prompt(client: TestClient, auth_headers: dict):
    """ทดสอบส่ง Prompt ว่าง (422 Validation Error)"""
    payload = {"prompt": "", "task_type": "txt2img"}
    response = client.post("/generations", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_list_generations_pagination(client: TestClient, auth_headers: dict):
    """ทดสอบดึงรายการประวัติงาน พร้อม Pagination"""
    response = client.get("/generations?page=1&page_size=10", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 10


def test_get_generation_by_id_success(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบดึงรายละเอียดงานเดี่ยวของตัวเอง (200 OK)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="mystic forest at dawn",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="pending"
    )
    db.add(gen)
    db.commit()

    response = client.get(f"/generations/{gen.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == str(gen.id)
    assert response.json()["prompt"] == "mystic forest at dawn"


def test_get_generation_not_found(client: TestClient, auth_headers: dict):
    """ทดสอบดึงงานที่ไม่มีอยู่จริง (404 Not Found)"""
    fake_id = uuid.uuid4()
    response = client.get(f"/generations/{fake_id}", headers=auth_headers)
    assert response.status_code == 404


def test_data_isolation_cannot_access_other_users_job(
    client: TestClient,
    test_user: User,
    other_auth_headers: dict,
    db: Session
):
    """
    🔐 Security / Data Isolation Test:
    User B ไม่สามารถเข้าถึงงานของ User A ได้ แม้จะรู้ ID ของงาน (คืน 404 Not Found)
    """
    gen_user_a = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="private artwork of User A",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="completed"
    )
    db.add(gen_user_a)
    db.commit()

    # User B พยายามเข้าถึงงานของ User A
    response = client.get(f"/generations/{gen_user_a.id}", headers=other_auth_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_download_image_not_ready(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบดาวน์โหลดภาพที่งานยังไม่เสร็จ (404 Image not ready)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="pending work",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="pending"
    )
    db.add(gen)
    db.commit()

    response = client.get(f"/generations/{gen.id}/image", headers=auth_headers)
    assert response.status_code == 404


def test_cancel_generation_success(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบยกเลิกงานที่กำลัง pending/processing อยู่ (คืน 200 พร้อม status=failed)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="job to be cancelled",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="pending"
    )
    db.add(gen)
    db.commit()

    response = client.post(f"/generations/{gen.id}/cancel", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "Cancelled by user" in data["error_message"]


def test_cancel_generation_not_found(client: TestClient, auth_headers: dict):
    """ทดสอบยกเลิกงานที่ไม่มีอยู่จริง (คืน 404)"""
    non_existent = uuid.uuid4()
    response = client.post(f"/generations/{non_existent}/cancel", headers=auth_headers)
    assert response.status_code == 404


def test_cancel_generation_already_completed(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบยกเลิกงานที่ completed ไปแล้ว (คืน 409 Conflict)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="completed job",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="completed"
    )
    db.add(gen)
    db.commit()

    response = client.post(f"/generations/{gen.id}/cancel", headers=auth_headers)
    assert response.status_code == 409


def test_server_timeout_auto_fails_old_job(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบระบบ Server-side Timeout: งานที่ค้าง processing นานเกิน 5 นาที จะถูกปรับเป็น failed อัตโนมัติเมื่อ query"""
    old_time = datetime.now(timezone.utc) - timedelta(seconds=350)
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="stuck job",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="processing",
        created_at=old_time
    )
    db.add(gen)
    db.commit()

    response = client.get(f"/generations/{gen.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error_message"].lower()


def test_create_generation_with_lora_list_and_dict(client: TestClient, auth_headers: dict):
    """ทดสอบสร้างงานพร้อม lora_config ทั้งในรูปแบบ Dict และ List"""
    # 1. รูปแบบ Dict
    payload_dict = {
        "prompt": "test prompt with lora dict",
        "task_type": "txt2img",
        "lora_config": {"name": "frieren", "scale": 0.8}
    }
    res_dict = client.post("/generations", json=payload_dict, headers=auth_headers)
    assert res_dict.status_code == 201

    # 2. รูปแบบ List
    payload_list = {
        "prompt": "test prompt with lora list",
        "task_type": "txt2img",
        "lora_config": [{"name": "frieren", "scale": 0.8}]
    }
    res_list = client.post("/generations", json=payload_list, headers=auth_headers)
    assert res_list.status_code == 201


def test_get_progress_completed(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบดึง progress สำหรับงานที่เสร็จแล้ว (status=completed, progress=1.0, seed คงเดิม)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="completed progress test",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=25,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="completed",
        seed=12345678,
        duration_seconds=3.2
    )
    db.add(gen)
    db.commit()

    res = client.get(f"/generations/{gen.id}/progress", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["progress"] == 1.0
    assert data["queue_position"] == 0
    assert data["seed"] == 12345678


def test_get_progress_failed(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบดึง progress สำหรับงานที่ล้มเหลว (status=failed, progress=0.0)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="failed progress test",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=25,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="failed",
        error_message="Simulated failure"
    )
    db.add(gen)
    db.commit()

    res = client.get(f"/generations/{gen.id}/progress", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "failed"
    assert data["progress"] == 0.0
    assert data["error"] == "Simulated failure"


def test_get_progress_processing_fallback(client: TestClient, test_user: User, auth_headers: dict, db: Session):
    """ทดสอบดึง progress สำหรับงานที่กำลัง processing (คืน progress fallback ได้ไม่พัง 500)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="processing progress test",
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

    res = client.get(f"/generations/{gen.id}/progress", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "processing"
    assert "progress" in data
    assert "queue_position" in data


def test_get_progress_unauthorized(client: TestClient, test_user: User, db: Session):
    """ทดสอบดึง progress โดยไม่ระบุ token (401 Unauthorized)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="unauth test",
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

    res = client.get(f"/generations/{gen.id}/progress")
    assert res.status_code == 401


def test_get_progress_data_isolation(client: TestClient, test_user: User, other_auth_headers: dict, db: Session):
    """ทดสอบ Data Isolation: User B ไม่สามารถดู progress งานของ User A ได้ (404)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="user a job",
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

    res = client.get(f"/generations/{gen.id}/progress", headers=other_auth_headers)
    assert res.status_code == 404
