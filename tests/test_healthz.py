"""
Test Suite: Health Check & Global Exception Handling
- /healthz database ping (healthy 200 vs degraded 503)
- Unhandled 500 exception handler with CORS header preservation
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from app.models import User


def test_healthz_healthy_db(client: TestClient):
    """ทดสอบ /healthz คืน 200 เมื่อฐานข้อมูลเชื่อมต่อได้ปกติ"""
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["service"] == "LUMA Backend API"


def test_healthz_unreachable_db(client: TestClient):
    """ทดสอบ /healthz คืน 503 เมื่อฐานข้อมูลล่ม"""
    with patch("main.SessionLocal", side_effect=Exception("Database connection timeout")):
        response = client.get("/healthz")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unreachable"


def test_unhandled_exception_preserves_cors(test_user: User):
    """ทดสอบว่า 500 error ยังคงมี CORS header ติดกลับมาหา frontend"""
    with TestClient(app, raise_server_exceptions=False) as client:
        with patch("app.api.auth.verify_password", side_effect=Exception("Unexpected crash")):
            response = client.post(
                "/auth/login",
                data={"username": test_user.username, "password": "SecureTestPass123!"},
                headers={"Origin": "http://localhost:5173"}
            )
            assert response.status_code == 500
            assert response.json() == {"detail": "Internal Server Error"}
            assert (
                response.headers.get("access-control-allow-origin") == "http://localhost:5173"
                or response.headers.get("access-control-allow-origin") == "*"
            )
