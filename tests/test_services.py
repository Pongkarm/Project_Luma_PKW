"""
Test Suite: Service Layer Unit & Integration Tests (Error Handling & Edge Cases)
- process_generation_task in Direct Mode (txt2img & img2img)
- process_generation_task in Callback Mode
- AI Server Timeout & Connection Error Handling
- AI Server 500 Internal Error Handling
- AI Server Missing Base64 Response
- get_generation_image_path Edge Cases (not completed, file missing)
- _mark_as_failed Database Rollback Safety
"""
import io
import time
import uuid
import pytest
import httpx
from pathlib import Path
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User, Generation
from app.schemas.generation import GenerationStatus, GenerationTaskType
from app.services import generation as generation_service
from mock_ai_server import generate_mock_image_base64


@pytest.mark.asyncio
async def test_service_process_direct_txt2img_success(db: Session, test_user: User, monkeypatch):
    """ทดสอบ process_generation_task โหมด Direct สำเร็จ (status -> completed)"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="a glowing crystal cavern",
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

    monkeypatch.setattr(settings, "AI_MODE", "direct")
    fake_b64 = generate_mock_image_base64("crystal cavern", 512, 512)

    # Mock HTTP response จาก AI Server
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "completed", "image_base64": fake_b64}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    assert gen.status == GenerationStatus.COMPLETED.value
    assert gen.output_path is not None
    assert Path(gen.output_path).is_file()


@pytest.mark.asyncio
async def test_service_process_direct_img2img_success(db: Session, test_user: User, monkeypatch, tmp_path):
    """ทดสอบ process_generation_task โหมด Direct สำหรับ img2img"""
    # สร้างไฟล์ภาพจำลอง
    img_file = tmp_path / "test_source.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\nfakeimagebytes")

    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="img2img",
        prompt="transform into cyberpunk style",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        source_image_path=str(img_file),
        status="pending"
    )
    db.add(gen)
    db.commit()

    monkeypatch.setattr(settings, "AI_MODE", "direct")
    fake_b64 = generate_mock_image_base64("cyberpunk transform", 512, 512)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "completed", "image_base64": fake_b64}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    assert gen.status == GenerationStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_service_process_callback_mode_dispatch(db: Session, test_user: User, monkeypatch):
    """ทดสอบ process_generation_task โหมด Callback ส่งงานไปยัง AI Server สำเร็จ"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="space station orbiting saturn",
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

    monkeypatch.setattr(settings, "AI_MODE", "callback")

    mock_resp = MagicMock()
    mock_resp.status_code = 202
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    # ในโหมด Callback สถานะจะยังคงเป็น processing รอ Callback ยิงกลับมา
    assert gen.status == GenerationStatus.PROCESSING.value


@pytest.mark.asyncio
async def test_service_ai_server_timeout_handling(db: Session, test_user: User, monkeypatch):
    """
    🛡️ Reliability Test: เมื่อ AI Server เกิด Timeout (30s)
    ระบบต้องไม่ crash และเปลี่ยนสถานะเป็น FAILED พร้อมบันทึก error
    """
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="timeout prompt",
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

    monkeypatch.setattr(settings, "AI_MODE", "direct")

    with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("AI Server Request Timed Out")):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    assert gen.status == GenerationStatus.FAILED.value
    assert "Timed Out" in gen.error_message


@pytest.mark.asyncio
async def test_service_ai_server_500_error_handling(db: Session, test_user: User, monkeypatch):
    """
    🛡️ Reliability Test: เมื่อ AI Server ตอบกลับ HTTP 500 Internal Server Error
    ระบบต้องจับได้และเปลี่ยนสถานะเป็น FAILED
    """
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="error prompt",
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

    monkeypatch.setattr(settings, "AI_MODE", "direct")

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError("500 Server Error", request=None, response=mock_resp)

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    assert gen.status == GenerationStatus.FAILED.value


@pytest.mark.asyncio
async def test_service_ai_server_missing_base64(db: Session, test_user: User, monkeypatch):
    """ทดสอบเมื่อ AI Server ตอบกลับมาแต่ไม่มีฟิลด์ image_base64"""
    gen = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="missing b64",
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

    monkeypatch.setattr(settings, "AI_MODE", "direct")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "completed", "image_base64": None}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        await generation_service.process_generation_task(gen.id)

    db.refresh(gen)
    assert gen.status == GenerationStatus.FAILED.value
    assert "missing" in gen.error_message.lower()


def test_get_generation_image_path_edge_cases(db: Session, test_user: User):
    """ทดสอบ get_generation_image_path กรณีงานยังไม่เสร็จ หรือไฟล์สูญหาย"""
    # 1. งานยังไม่เสร็จ (pending)
    gen_pending = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="test pending",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="pending"
    )
    db.add(gen_pending)
    db.commit()

    res = generation_service.get_generation_image_path(db, test_user.id, gen_pending.id)
    assert res is None

    # 2. งาน completed แต่ output_path ชี้ไปไฟล์ที่ไม่มีอยู่จริง
    gen_missing_file = Generation(
        id=uuid.uuid4(),
        user_id=test_user.id,
        task_type="txt2img",
        prompt="test missing file",
        model_name="sd-v1-5",
        sampler_name="Euler a",
        steps=20,
        cfg_scale=7.0,
        width=512,
        height=512,
        status="completed",
        output_path="/non_existent_directory_12345/missing.png"
    )
    db.add(gen_missing_file)
    db.commit()

    res2 = generation_service.get_generation_image_path(db, test_user.id, gen_missing_file.id)
    assert res2 is None
