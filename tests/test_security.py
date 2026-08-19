"""
Test Suite: Security, Cryptography & Tokens
- Bcrypt Password Hashing
- JWT Token Expiry & Tamper Resistance
- SQL Injection Defense
- CORS Configuration
"""
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_hashing_bcrypt():
    """ทดสอบว่า hash_password สร้าง Bcrypt hash ที่ไม่ตรงกับ plain text และ verify ได้ถูกต้อง"""
    raw_pass = "MySecretPassword123!"
    hashed = hash_password(raw_pass)

    assert hashed != raw_pass
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_creation_and_decoding():
    """ทดสอบการสร้างและถอดรหัส JWT Token"""
    payload_data = {"sub": "12345-67890-test-user"}
    token = create_access_token(payload_data)
    decoded = decode_token(token)

    assert decoded is not None
    assert decoded["sub"] == "12345-67890-test-user"
    assert "exp" in decoded


def test_jwt_expired_token_handling():
    """ทดสอบว่า Token ที่หมดอายุแล้วจะไม่สามารถ Decode ได้ (คืน None)"""
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    expired_token = jwt.encode(
        {"sub": "expired-user", "exp": expired_time},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    decoded = decode_token(expired_token)
    assert decoded is None


def test_jwt_tampered_token_handling():
    """ทดสอบว่า Token ที่ถูกปลอมแปลงลายเซ็นต์จะถูกปฏิเสธ"""
    fake_token = jwt.encode(
        {"sub": "hacker-user"},
        "wrong-secret-key-12345",
        algorithm=settings.ALGORITHM
    )
    decoded = decode_token(fake_token)
    assert decoded is None


def test_sql_injection_defense(client: TestClient):
    """ทดสอบการส่ง SQL Injection Payload ในการ Login"""
    sql_injection_payloads = [
        "' OR '1'='1",
        "admin' --",
        "admin' /*",
        "' OR 1=1 --",
    ]
    for sql_payload in sql_injection_payloads:
        response = client.post("/auth/login", data={"username": sql_payload, "password": "any_password"})
        assert response.status_code == 401


def test_cors_headers(client: TestClient):
    """ทดสอบ CORS Headers ว่าอนุญาต Cross-Origin Requests ตามที่กำหนด"""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
    }
    response = client.options("/auth/login", headers=headers)
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
