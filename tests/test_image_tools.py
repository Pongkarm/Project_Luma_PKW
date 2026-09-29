"""
Unit & Integration Tests for Image Processing Studio Tools (/api/tools/*)
"""
import io
import time
import cv2
import numpy as np
import pytest
from PIL import Image

from app.services import image_tools


def _create_test_image_bytes(width=128, height=128, color=(0, 255, 0), fmt="PNG") -> bytes:
    """Helper สำหรับสร้างไฟล์ภาพในหน่วยความจำ"""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf.getvalue()


# ─────────────────────────────────────────
# 1. Unit Tests for image_tools service functions
# ─────────────────────────────────────────

def test_generate_pencil_sketch():
    """ทดสอบการสร้าง Pencil Sketch ด้วย Color Dodge"""
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    test_img[:, :] = (120, 200, 80)

    sketch, actual_ksize = image_tools.generate_pencil_sketch(test_img, blur_ksize=20)
    assert sketch.shape == (100, 100, 3)
    assert sketch.dtype == np.uint8
    assert actual_ksize == 21  # ปัดเป็นเลขคี่อัตโนมัติ


def test_apply_color_splash():
    """ทดสอบ Color Splash ทั้งโหมด green และ red"""
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    test_img[:50, :] = (0, 255, 0)   # เขียว
    test_img[50:, :] = (0, 0, 255)   # แดง

    splash_green = image_tools.apply_color_splash(test_img, target_color="green")
    assert splash_green.shape == (100, 100, 3)

    splash_red = image_tools.apply_color_splash(test_img, target_color="red")
    assert splash_red.shape == (100, 100, 3)


def test_smart_remove_background():
    """ทดสอบการตัดฉากหลัง GrabCut + Morphology Close แบบ Optimized Multiscale"""
    test_img = np.ones((600, 600, 3), dtype=np.uint8) * 200
    test_img[100:500, 100:500] = (20, 20, 240)

    rgba, clean_mask = image_tools.smart_remove_background(test_img)
    # ต้องได้ขนาดเท่าเดิม 600x600 พอดี
    assert rgba.shape == (600, 600, 4)
    assert clean_mask.shape == (600, 600)
    assert clean_mask.dtype == np.uint8


def test_extract_pose_skeleton_no_pose():
    """ทดสอบ MediaPipe Pose บนภาพที่ไม่มีคน — คืนภาพเดิมพร้อม landmarks ว่าง []"""
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    annotated, landmarks = image_tools.extract_pose_skeleton(test_img)
    assert annotated.shape == (100, 100, 3)
    assert isinstance(landmarks, list)
    assert len(landmarks) == 0


def test_cleanup_old_tool_results():
    """ทดสอบการล้างไฟล์ที่เก่ากว่า 24 ชม."""
    dummy_file = image_tools.TOOLS_OUTPUT_DIR / "cleanup_test_dummy.png"
    dummy_file.write_bytes(b"dummy")
    # ตั้ง mtime ย้อนหลัง 48 ชั่วโมง
    old_time = time.time() - (48 * 3600)
    import os
    os.utime(dummy_file, (old_time, old_time))

    deleted = image_tools.cleanup_old_tool_results(max_age_hours=24)
    assert deleted >= 1
    assert not dummy_file.exists()


# ─────────────────────────────────────────
# 2. Integration Tests for API Endpoints (/api/tools/*)
# ─────────────────────────────────────────

def test_api_tools_unauthorized(client):
    """เรียก API โดยไม่แนบ Token ต้องถูกปฏิเสธ 401 Unauthorized"""
    res = client.post("/api/tools/sketch")
    assert res.status_code == 401


def test_api_tools_sketch(client, auth_headers):
    """ทดสอบ POST /api/tools/sketch พร้อมอัปโหลดไฟล์"""
    img_bytes = _create_test_image_bytes(color=(100, 150, 200))
    files = {"file": ("source.png", img_bytes, "image/png")}
    data = {"blur_ksize": "20"}

    res = client.post("/api/tools/sketch", headers=auth_headers, files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "sketch"
    assert "/api/tools/results/sketch_" in body["result_image_url"]
    assert body["metadata"]["blur_ksize"] == 21  # แสดงค่าที่ใช้จริง


def test_api_tools_sketch_validation(client, auth_headers):
    """ทดสอบ Validation blur_ksize เกินช่วง (ge=3, le=51) ต้องได้ 422"""
    img_bytes = _create_test_image_bytes()
    files = {"file": ("source.png", img_bytes, "image/png")}

    # เกิน 51
    res = client.post("/api/tools/sketch", headers=auth_headers, files=files, data={"blur_ksize": "301"})
    assert res.status_code == 422

    # น้อยกว่า 3
    res2 = client.post("/api/tools/sketch", headers=auth_headers, files=files, data={"blur_ksize": "1"})
    assert res2.status_code == 422


def test_api_tools_color_splash(client, auth_headers):
    """ทดสอบ POST /api/tools/color-splash"""
    img_bytes = _create_test_image_bytes(color=(0, 255, 0))
    files = {"file": ("source.png", img_bytes, "image/png")}
    data = {"target_color": "green"}

    res = client.post("/api/tools/color-splash", headers=auth_headers, files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "color-splash"
    assert "/api/tools/results/splash_" in body["result_image_url"]


def test_api_tools_color_splash_validation(client, auth_headers):
    """ทดสอบ target_color ที่ไม่ใช่ 'green' หรือ 'red' ต้องได้ 422"""
    img_bytes = _create_test_image_bytes()
    files = {"file": ("source.png", img_bytes, "image/png")}
    res = client.post("/api/tools/color-splash", headers=auth_headers, files=files, data={"target_color": "blue"})
    assert res.status_code == 422


def test_api_tools_remove_bg(client, auth_headers):
    """ทดสอบ POST /api/tools/remove-bg ได้ทั้งภาพโปร่งใสและ Inpaint Mask"""
    img_bytes = _create_test_image_bytes(color=(255, 200, 100))
    files = {"file": ("source.png", img_bytes, "image/png")}

    res = client.post("/api/tools/remove-bg", headers=auth_headers, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "remove-bg"
    assert "/api/tools/results/nobg_" in body["result_image_url"]
    assert "/api/tools/results/mask_" in body["mask_image_url"]


def test_api_tools_pose(client, auth_headers):
    """ทดสอบ POST /api/tools/pose (ภาพไม่มีคน คืน 200 + landmarks: [])"""
    img_bytes = _create_test_image_bytes(color=(50, 50, 50))
    files = {"file": ("source.png", img_bytes, "image/png")}

    res = client.post("/api/tools/pose", headers=auth_headers, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "pose"
    assert "/api/tools/results/pose_" in body["result_image_url"]
    assert body["landmarks"] == []


def test_api_tools_get_result_image(client, auth_headers):
    """ทดสอบ GET /api/tools/results/{filename} สามารถดาวน์โหลดภาพได้ และรองรับ Authorization header"""
    # 1. สั่งรัน sketch เพื่อสร้างไฟล์ผลลัพธ์จริง
    img_bytes = _create_test_image_bytes()
    files = {"file": ("source.png", img_bytes, "image/png")}
    create_res = client.post("/api/tools/sketch", headers=auth_headers, files=files)
    result_url = create_res.json()["result_image_url"]
    filename = result_url.split("/")[-1]

    # 2. ดึงไฟล์ผลลัพธ์ผ่าน Endpoint GET พร้อมแนบ Authorization Header
    get_res = client.get(f"/api/tools/results/{filename}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.headers["content-type"] == "image/png"
    assert len(get_res.content) > 0


def test_api_tools_get_result_traversal_blocked(client):
    """ทดสอบป้องกัน Path Traversal ใน GET /api/tools/results/.."""
    res = client.get("/api/tools/results/../../etc/passwd")
    assert res.status_code == 404


def test_api_tools_jpeg_named_source_png(client, auth_headers):
    """ทดสอบกรณี Frontend แนบไฟล์ JPEG แต่ตั้งชื่อว่า source.png"""
    img = Image.new("RGB", (100, 100), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    files = {"file": ("source.png", jpeg_bytes, "image/png")}
    res = client.post("/api/tools/sketch", headers=auth_headers, files=files, data={"blur_ksize": "31"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["metadata"]["blur_ksize"] == 31


def test_api_tools_rgba_input(client, auth_headers):
    """ทดสอบกรณีส่งภาพ RGBA (มี Alpha Channel) เข้ามา เช่น ภาพหลังตัดฉากหลัง"""
    img = Image.new("RGBA", (100, 100), color=(0, 255, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    rgba_bytes = buf.getvalue()

    files = {"file": ("source.png", rgba_bytes, "image/png")}
    res = client.post("/api/tools/color-splash", headers=auth_headers, files=files, data={"target_color": "green"})
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_api_tools_oversized_dimension(client, auth_headers):
    """ทดสอบส่งภาพที่มีขนาดด้านใดด้านหนึ่งเกิน 4096 px ต้องได้ 413"""
    img = Image.new("RGB", (4200, 10), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    huge_bytes = buf.getvalue()

    files = {"file": ("source.png", huge_bytes, "image/png")}
    res = client.post("/api/tools/sketch", headers=auth_headers, files=files)
    assert res.status_code == 413
    assert "exceeds maximum allowed" in res.json()["detail"]


def test_api_tools_corrupted_file(client, auth_headers):
    """ทดสอบกรณีส่งไฟล์เสีย / ไม่ใช่ภาพ ต้องตอบ 422"""
    files = {"file": ("source.png", b"not-a-valid-image-data", "image/png")}
    res = client.post("/api/tools/sketch", headers=auth_headers, files=files)
    assert res.status_code == 422
    assert "detail" in res.json()
