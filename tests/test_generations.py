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
