"""
Test Suite: Image Upload & img2img / Inpaint Validation
- POST /uploads (5-layer validation: size, MIME, magic bytes, dimensions, EXIF strip)
- GET /uploads/{filename} (Cache-Control 24h)
- HEAD /uploads/{filename}
- img2img & Inpaint Job Creation with uploaded files
"""
import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User, Generation
from app.schemas.generation import GenerationTaskType, GenerationStatus


def create_test_image_bytes(format="PNG", width=200, height=200, color=(100, 150, 200)) -> bytes:
    """Helper: สร้างไบนารีรูปภาพจำลองใน Memory"""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_upload_valid_png_success(client: TestClient, auth_headers: dict):
    """ทดสอบอัปโหลดไฟล์ PNG ที่ถูกต้อง (201 Created)"""
    img_bytes = create_test_image_bytes(format="PNG", width=256, height=256)
    files = {"file": ("test_avatar.png", img_bytes, "image/png")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()

    assert "file_id" in data
    assert data["filename"].endswith(".png")
    assert data["url"] == f"/uploads/{data['filename']}"
    assert data["width"] == 256
    assert data["height"] == 256
    assert data["format"] == "PNG"
    assert data["size_bytes"] > 0


def test_upload_valid_jpeg_success(client: TestClient, auth_headers: dict):
    """ทดสอบอัปโหลดไฟล์ JPEG ที่ถูกต้อง (201 Created)"""
    img_bytes = create_test_image_bytes(format="JPEG", width=300, height=200)
    files = {"file": ("photo.jpg", img_bytes, "image/jpeg")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["filename"].endswith(".jpg")
    assert data["format"] == "JPEG"


def test_upload_valid_webp_success(client: TestClient, auth_headers: dict):
    """ทดสอบอัปโหลดไฟล์ WEBP ที่ถูกต้อง (201 Created)"""
    img_bytes = create_test_image_bytes(format="WEBP", width=128, height=128)
    files = {"file": ("image.webp", img_bytes, "image/webp")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["filename"].endswith(".webp")
    assert data["format"] == "WEBP"


def test_upload_unauthorized_rejected(client: TestClient):
    """ทดสอบอัปโหลดโดยไม่มีสิทธิ์ (401 Unauthorized)"""
    img_bytes = create_test_image_bytes()
    files = {"file": ("test.png", img_bytes, "image/png")}
    response = client.post("/uploads", files=files)
    assert response.status_code == 401


def test_upload_oversized_file_rejected(client: TestClient, auth_headers: dict, monkeypatch):
    """ทดสอบอัปโหลดไฟล์ขนาดเกิน Limit 10MB (413 Request Entity Too Large)"""
    # จำลอง Limit เล็กๆ สำหรับทดสอบ
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 500)
    large_bytes = create_test_image_bytes(width=500, height=500)
    files = {"file": ("oversized.png", large_bytes, "image/png")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 413
    assert "exceeds maximum limit" in response.json()["detail"]


def test_upload_invalid_mime_type_rejected(client: TestClient, auth_headers: dict):
    """ทดสอบอัปโหลดไฟล์ประเภทที่ไม่รองรับ เช่น text/plain หรือ application/pdf (415 Unsupported Media Type)"""
    files = {"file": ("document.pdf", b"%PDF-1.4 fake pdf bytes", "application/pdf")}
    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 415
    assert "Unsupported media type" in response.json()["detail"]


def test_upload_invalid_magic_bytes_rejected(client: TestClient, auth_headers: dict):
    """
    🔐 Security Test: ส่งไฟล์ปลอม (EXE / Script) ที่เปลี่ยนนามสกุลเป็น .png
    ระบบต้องจับได้จาก Magic Bytes และตอบ 422 Unprocessable Entity
    """
    fake_png_payload = b"MZ\x90\x00\x03\x00\x00\x00 fake executable file contents"
    files = {"file": ("malware.png", fake_png_payload, "image/png")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 422
    assert "Magic bytes mismatch" in response.json()["detail"]


def test_upload_corrupted_image_rejected(client: TestClient, auth_headers: dict):
    """ทดสอบส่ง Header PNG แท้แต่เนื้อหาไบนารีข้างในพังเสียหาย (422 Unprocessable Entity)"""
    corrupt_bytes = b"\x89PNG\r\n\x1a\ncorruptdatahere"
    files = {"file": ("corrupt.png", corrupt_bytes, "image/png")}

    response = client.post("/uploads", files=files, headers=auth_headers)
    assert response.status_code == 422


def test_get_uploaded_image_with_cache_headers(client: TestClient, auth_headers: dict):
    """ทดสอบดึงภาพจาก /uploads/{filename} พร้อมตรวจสอบ Header Cache-Control 24h"""
    img_bytes = create_test_image_bytes(format="PNG", width=100, height=100)
    upload_res = client.post("/uploads", files={"file": ("cache_test.png", img_bytes, "image/png")}, headers=auth_headers)
    filename = upload_res.json()["filename"]

    get_res = client.get(f"/uploads/{filename}")
    assert get_res.status_code == 200
    assert "cache-control" in get_res.headers
    assert "max-age=86400" in get_res.headers["cache-control"]
    assert len(get_res.content) > 0


def test_head_uploaded_image_exists(client: TestClient, auth_headers: dict):
    """ทดสอบ HEAD /uploads/{filename} ตรวจสอบความมีอยู่ของไฟล์"""
    img_bytes = create_test_image_bytes(format="PNG", width=100, height=100)
    upload_res = client.post("/uploads", files={"file": ("head_test.png", img_bytes, "image/png")}, headers=auth_headers)
    filename = upload_res.json()["filename"]

    head_res = client.head(f"/uploads/{filename}")
    assert head_res.status_code == 200

    head_missing = client.head("/uploads/missing_file_12345.png")
    assert head_missing.status_code == 404


def test_create_img2img_generation_success(client: TestClient, auth_headers: dict):
    """ทดสอบสร้างงาน img2img โดยอ้างอิงภาพที่เพิ่งอัปโหลดสำเร็จ (201 Created)"""
    # 1. อัปโหลดภาพก่อน
    img_bytes = create_test_image_bytes(format="PNG", width=256, height=256)
    upload_res = client.post("/uploads", files={"file": ("base_for_img2img.png", img_bytes, "image/png")}, headers=auth_headers)
    uploaded_url = upload_res.json()["url"]

    # 2. สร้างงาน img2img
    payload = {
        "prompt": "anime style remake with vibrant watercolor brushstrokes",
        "task_type": "img2img",
        "source_image_path": uploaded_url,
        "denoising_strength": 0.65,
        "model_name": "novaAnimeXL_ilV190.safetensors",
        "width": 512,
        "height": 512
    }
    gen_res = client.post("/generations", json=payload, headers=auth_headers)
    assert gen_res.status_code == 201
    data = gen_res.json()
    assert data["task_type"] == "img2img"
    assert data["status"] == GenerationStatus.PENDING.value
    assert data["source_image_path"] is not None


def test_create_img2img_missing_source_rejected(client: TestClient, auth_headers: dict):
    """ทดสอบสร้างงาน img2img โดยไม่ระบุ source_image_path (422 Unprocessable Entity)"""
    payload = {
        "prompt": "make it cyberpunk",
        "task_type": "img2img",
        "source_image_path": None,
        "model_name": "sd-v1-5"
    }
    response = client.post("/generations", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "requires 'source_image_path'" in response.json()["detail"]


def test_create_img2img_nonexistent_source_rejected(client: TestClient, auth_headers: dict):
    """ทดสอบสร้างงาน img2img โดยระบุไฟล์ที่ไม่มีอยู่จริงบน Server (404 Not Found)"""
    payload = {
        "prompt": "make it fantasy",
        "task_type": "img2img",
        "source_image_path": "/uploads/non_existent_fake_file_9999.png",
        "model_name": "sd-v1-5"
    }
    response = client.post("/generations", json=payload, headers=auth_headers)
    assert response.status_code == 404
    assert "Source image file not found" in response.json()["detail"]
