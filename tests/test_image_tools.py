"""
Unit & Integration Tests for Image Processing Studio Tools (/api/tools/*)
"""
import io
import cv2
import numpy as np
import pytest
from PIL import Image

from app.services import image_tools


def _create_test_image_bytes(width=128, height=128, color=(0, 255, 0)) -> bytes:
    """Helper สำหรับสร้างไฟล์ภาพ PNG จำลองในหน่วยความจำ"""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


# ─────────────────────────────────────────
# 1. Unit Tests for image_tools service functions
# ─────────────────────────────────────────

def test_generate_pencil_sketch():
    """ทดสอบการสร้าง Pencil Sketch ด้วย Color Dodge"""
    # สร้างภาพไล่เฉดสี
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    test_img[:, :] = (120, 200, 80)

    sketch = image_tools.generate_pencil_sketch(test_img, blur_ksize=21)
    assert sketch.shape == (100, 100, 3)
    assert sketch.dtype == np.uint8


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
    """ทดสอบการตัดฉากหลัง GrabCut + Morphology Close"""
    test_img = np.ones((100, 100, 3), dtype=np.uint8) * 200
    # วัตถุตรงกลาง
    test_img[20:80, 20:80] = (20, 20, 240)

    rgba, clean_mask = image_tools.smart_remove_background(test_img)
    assert rgba.shape == (100, 100, 4)
    assert clean_mask.shape == (100, 100)
    assert clean_mask.dtype == np.uint8


def test_extract_pose_skeleton_no_pose():
    """ทดสอบ MediaPipe Pose บนภาพที่ไม่มีคน — ต้องไม่ Error และคืนพิกัดว่าง"""
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    annotated, landmarks = image_tools.extract_pose_skeleton(test_img)
    assert annotated.shape == (100, 100, 3)
    assert isinstance(landmarks, list)
    assert len(landmarks) == 0


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
    files = {"file": ("test.png", img_bytes, "image/png")}
    data = {"blur_ksize": "15"}

    res = client.post("/api/tools/sketch", headers=auth_headers, files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "sketch"
    assert "/api/tools/results/" in body["result_image_url"]


def test_api_tools_color_splash(client, auth_headers):
    """ทดสอบ POST /api/tools/color-splash"""
    img_bytes = _create_test_image_bytes(color=(0, 255, 0))
    files = {"file": ("splash_test.png", img_bytes, "image/png")}
    data = {"target_color": "green"}

    res = client.post("/api/tools/color-splash", headers=auth_headers, files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "color-splash"
    assert "/api/tools/results/" in body["result_image_url"]


def test_api_tools_remove_bg(client, auth_headers):
    """ทดสอบ POST /api/tools/remove-bg ได้ทั้งภาพโปร่งใสและ Inpaint Mask"""
    img_bytes = _create_test_image_bytes(color=(255, 200, 100))
    files = {"file": ("bg_test.png", img_bytes, "image/png")}

    res = client.post("/api/tools/remove-bg", headers=auth_headers, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "remove-bg"
    assert "/api/tools/results/nobg_" in body["result_image_url"]
    assert "/api/tools/results/mask_" in body["mask_image_url"]


def test_api_tools_pose(client, auth_headers):
    """ทดสอบ POST /api/tools/pose"""
    img_bytes = _create_test_image_bytes(color=(50, 50, 50))
    files = {"file": ("pose_test.png", img_bytes, "image/png")}

    res = client.post("/api/tools/pose", headers=auth_headers, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["tool"] == "pose"
    assert "/api/tools/results/pose_" in body["result_image_url"]
    assert "landmarks" in body


def test_api_tools_get_result_image(client, auth_headers):
    """ทดสอบ GET /api/tools/results/{filename} สามารถดาวน์โหลดภาพผลลัพธ์ได้"""
    # 1. สั่งรัน sketch เพื่อสร้างไฟล์ผลลัพธ์จริง
    img_bytes = _create_test_image_bytes()
    files = {"file": ("sample.png", img_bytes, "image/png")}
    create_res = client.post("/api/tools/sketch", headers=auth_headers, files=files)
    result_url = create_res.json()["result_image_url"]
    filename = result_url.split("/")[-1]

    # 2. ดึงไฟล์ผลลัพธ์ผ่าน Endpoint GET (ทดสอบกรณีที่ Frontend แนบ Authorization Header ไปด้วย)
    get_res = client.get(f"/api/tools/results/{filename}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.headers["content-type"] == "image/png"
    assert len(get_res.content) > 0


def test_api_tools_jpeg_named_source_png(client, auth_headers):
    """ทดสอบกรณี Frontend แนบไฟล์ JPEG แต่ตั้งชื่อว่า source.png"""
    # สร้างภาพ JPEG จริง
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


def test_api_tools_corrupted_file(client, auth_headers):
    """ทดสอบกรณีส่งไฟล์เสีย / ไม่ใช่ภาพ ต้องตอบ 422"""
    files = {"file": ("source.png", b"not-a-valid-image-data", "image/png")}
    res = client.post("/api/tools/sketch", headers=auth_headers, files=files)
    assert res.status_code == 422
    assert "detail" in res.json()

