"""
Test Suite: Authentication Endpoints
- POST /auth/register
- POST /auth/login
- GET /auth/me
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.core.security import hash_password, create_access_token


def test_register_success(client: TestClient):
    """ทดสอบสมัครสมาชิกสำเร็จ (201 Created)"""
    uid = uuid.uuid4().hex[:6]
    payload = {
        "username": f"newuser_{uid}",
        "email": f"newuser_{uid}@example.com",
        "password": "Password123!"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == payload["username"]
    assert data["email"] == payload["email"]
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data


def test_register_duplicate_username(client: TestClient, test_user: User):
    """ทดสอบสมัครด้วย Username ซ้ำ (400 Bad Request)"""
    payload = {
        "username": test_user.username,
        "email": f"unique_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "ถูกใช้แล้ว" in response.json()["detail"]


def test_register_duplicate_email(client: TestClient, test_user: User):
    """ทดสอบสมัครด้วย Email ซ้ำ (400 Bad Request)"""
    payload = {
        "username": f"unique_{uuid.uuid4().hex[:6]}",
        "email": test_user.email,
        "password": "Password123!"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "ถูกใช้แล้ว" in response.json()["detail"]


def test_register_invalid_email(client: TestClient):
    """ทดสอบส่ง Email ผิด Format (422 Unprocessable Entity)"""
    payload = {
        "username": f"bademail_{uuid.uuid4().hex[:6]}",
        "email": "not-an-email",
        "password": "Password123!"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422


def test_login_success(client: TestClient, db: Session):
    """ทดสอบ Login สำเร็จ ได้รับ JWT Bearer Token (200 OK)"""
    uid = uuid.uuid4().hex[:6]
    username = f"logintest_{uid}"
    raw_password = "SecretLogin123!"
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(raw_password),
        is_active=True
    )
    db.add(user)
    db.commit()

    response = client.post("/auth/login", data={"username": username, "password": raw_password})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, test_user: User):
    """ทดสอบ Login รหัสผ่านผิด (401 Unauthorized)"""
    response = client.post("/auth/login", data={"username": test_user.username, "password": "WrongPassword!"})
    assert response.status_code == 401
    assert "WWW-Authenticate" in response.headers


def test_login_nonexistent_user(client: TestClient):
    """ทดสอบ Login ผู้ใช้ที่ไม่มีในระบบ (401 Unauthorized)"""
    response = client.post("/auth/login", data={"username": "ghost_user_404", "password": "AnyPassword!"})
    assert response.status_code == 401


def test_get_me_success(client: TestClient, test_user: User, auth_headers: dict):
    """ทดสอบ GET /auth/me ได้ข้อมูลโปรไฟล์ถูกต้องและไม่มี Password Hash"""
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_user.id)
    assert data["username"] == test_user.username
    assert data["email"] == test_user.email
    assert "total_generations" in data
    assert "password_hash" not in data


def test_get_me_unauthorized(client: TestClient):
    """ทดสอบ GET /auth/me โดยไม่ส่ง Token (401 Unauthorized)"""
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_get_me_invalid_token(client: TestClient):
    """ทดสอบ GET /auth/me ด้วย Token ปลอม (401 Unauthorized)"""
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401
