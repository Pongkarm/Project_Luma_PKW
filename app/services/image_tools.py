"""
Image Processing Tools Service
รวบรวมฟังก์ชันประมวลผลภาพทั้ง 4 ฟังก์ชันสำหรับ Creative Studio (LUMA):
1. MediaPipe Pose Detection: สกัดโครงสร้างสรีระร่างกาย 33 จุด
2. Artistic Pencil Sketch: แปลงภาพเป็นลายเส้นดินสอด้วย Color Dodge Blend
3. Color Splash Filter: ดูดสีเด่น (Red/Green) รอบข้างเป็น Grayscale
4. Smart Background Removal: ตัดฉากหลังด้วย GrabCut + Morphology พร้อมสร้าง Inpaint Mask (Optimized ด้วย Multiscale GrabCut)
"""

import io
import os
import time
import uuid
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional

import cv2
import numpy as np

from app.core.config import settings

try:
    import mediapipe as mp
except ImportError:
    mp = None

logger = logging.getLogger(__name__)

# ไดเรกทอรีสำหรับเก็บผลลัพธ์ของ Tools
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TOOLS_OUTPUT_DIR = BASE_DIR / "outputs" / "tools"
TOOLS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# -------------------------------------------------------------
# Utility Functions สำหรับการโหลดและบันทึกภาพ
# -------------------------------------------------------------

def load_image_from_bytes(data: bytes) -> np.ndarray:
    """
    แปลง bytes ของภาพเป็น OpenCV BGR numpy array
    - ตรวจสอบความละเอียดไม่ให้เกิน MAX_IMAGE_DIMENSION (4096px)
    - รองรับภาพ RGBA โดยทำการ Composite ทับพื้นหลังสีขาวเพื่อความคมชัด
    - รองรับภาพ Grayscale โดยแปลงเป็น 3-Channel BGR
    - ถอดรหัสจากเนื้อหาจริง (Magic Bytes) ไม่พึ่งพานามสกุลไฟล์
    """
    nparr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError("Cannot decode image data. Corrupted or unsupported format.")

    h, w = image.shape[:2]
    if max(h, w) > settings.MAX_IMAGE_DIMENSION:
        raise ValueError(
            f"Image dimension ({w}x{h} px) exceeds maximum allowed {settings.MAX_IMAGE_DIMENSION} px."
        )

    # กรณีภาพมี Alpha Channel (4 channels: BGRA)
    if len(image.shape) == 3 and image.shape[2] == 4:
        alpha = image[:, :, 3].astype(float) / 255.0
        bgr = image[:, :, :3].astype(float)
        white = np.ones_like(bgr) * 255.0
        blended = bgr * alpha[:, :, np.newaxis] + white * (1.0 - alpha[:, :, np.newaxis])
        return blended.astype(np.uint8)

    # กรณีภาพขาว-ดำ 1 Channel
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    return image


def save_tool_result(image_arr: np.ndarray, prefix: str = "result") -> Tuple[str, Path]:
    """
    บันทึกภาพผลลัพธ์เป็นไฟล์ PNG ลงใน outputs/tools/
    ส่งคืน (api_relative_url, absolute_path)
    """
    file_id = uuid.uuid4().hex
    filename = f"{prefix}_{file_id}.png"
    target_path = TOOLS_OUTPUT_DIR / filename

    cv2.imwrite(str(target_path), image_arr)
    relative_url = f"/api/tools/results/{filename}"
    return relative_url, target_path


def cleanup_old_tool_results(max_age_hours: int = 24) -> int:
    """
    ลบไฟล์ผลลัพธ์ใน outputs/tools/ ที่มีอายุเกิน max_age_hours (default: 24 ชม.)
    คืนค่าจำนวนไฟล์ที่ถูกลบ
    """
    cutoff = time.time() - (max_age_hours * 3600)
    deleted_count = 0
    if not TOOLS_OUTPUT_DIR.exists():
        return 0

    for item in TOOLS_OUTPUT_DIR.glob("*.png"):
        try:
            if item.is_file() and item.stat().st_mtime < cutoff:
                item.unlink()
                deleted_count += 1
        except Exception as e:
            logger.warning(f"Failed to delete old tool result {item.name}: {e}")

    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} old tool result images (> {max_age_hours}h).")
    return deleted_count


# -------------------------------------------------------------
# 1. MediaPipe Pose Landmark Detection (คนที่ 1)
# -------------------------------------------------------------

def extract_pose_skeleton(image_bgr: np.ndarray) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    ตรวจจับท่าทางและสรีระ 33 จุด (MediaPipe Pose)
    - วาดเส้นโครงร่าง (Skeleton) และจุด Landmarks ลงบนภาพต้นฉบับ
    - ส่งออกรายการพิกัด JSON 33 จุด (id, name, x, y, z, visibility)
    - หากไม่พบคน จะส่งคืนภาพเดิมพร้อม landmarks ว่าง []
    """
    if mp is None or not hasattr(mp, "solutions") or not hasattr(mp.solutions, "pose"):
        raise RuntimeError("MediaPipe Pose solution is not available.")

    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    annotated_image = image_bgr.copy()
    landmarks_data: List[Dict[str, Any]] = []

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5
    ) as pose:
        results = pose.process(image_rgb)

        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
                connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
            )

            for idx, lm in enumerate(results.pose_landmarks.landmark):
                name = mp_pose.PoseLandmark(idx).name if hasattr(mp_pose, "PoseLandmark") else f"POINT_{idx}"
                landmarks_data.append({
                    "id": idx,
                    "name": name,
                    "x": round(float(lm.x), 4),
                    "y": round(float(lm.y), 4),
                    "z": round(float(lm.z), 4),
                    "visibility": round(float(lm.visibility), 4),
                })

    return annotated_image, landmarks_data


# -------------------------------------------------------------
# 2. Artistic Pencil Sketch (คนที่ 2)
# -------------------------------------------------------------

def generate_pencil_sketch(image_bgr: np.ndarray, blur_ksize: int = 21) -> Tuple[np.ndarray, int]:
    """
    แปลงภาพถ่าย/ภาพสีเป็นภาพลายเส้นดินสอ (Color Dodge Blend) จาก Lecture 9
    สูตร:
      1. Gray = cvtColor(BGR2GRAY)
      2. Invert = 255 - Gray
      3. Blur = GaussianBlur(Invert, (k, k), 0)
      4. Sketch = cv2.divide(Gray, 255 - Blur, scale=256)
    คืนค่า (sketch_bgr, actual_blur_ksize)
    """
    # ปรับ ksize ให้เป็นเลขคี่และอย่างน้อย 3
    actual_ksize = blur_ksize if blur_ksize % 2 != 0 else blur_ksize + 1
    actual_ksize = max(3, actual_ksize)

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    inv_gray = cv2.bitwise_not(gray)
    blurred = cv2.GaussianBlur(inv_gray, (actual_ksize, actual_ksize), 0)
    sketch_gray = cv2.divide(gray, 255 - blurred, scale=256)

    sketch_bgr = cv2.cvtColor(sketch_gray, cv2.COLOR_GRAY2BGR)
    return sketch_bgr, actual_ksize


# -------------------------------------------------------------
# 3. Color Splash & Mood Tint Filter (คนที่ 3)
# -------------------------------------------------------------

def apply_color_splash(image_bgr: np.ndarray, target_color: str = "green") -> np.ndarray:
    """
    ดูดสีเด่นเฉพาะสีที่กำหนด และปรับส่วนที่เหลือเป็นขาวดำ (Color Space HSV จาก Lecture 3 & Work 5)
    - รองรับ: 'green' และ 'red'
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    color_lower = target_color.lower().strip()

    if color_lower == "red":
        # สีแดงใน HSV ครอบคลุมสองช่วง (0-10 และ 170-180)
        mask1 = cv2.inRange(hsv, np.array([0, 50, 50]), np.array([10, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([170, 50, 50]), np.array([180, 255, 255]))
        mask = cv2.bitwise_or(mask1, mask2)
    else:
        # Default: green
        mask = cv2.inRange(hsv, np.array([35, 40, 40]), np.array([85, 255, 255]))

    colored_part = cv2.bitwise_and(image_bgr, image_bgr, mask=mask)
    inv_mask = cv2.bitwise_not(mask)
    background_gray = cv2.bitwise_and(gray_bgr, gray_bgr, mask=inv_mask)

    result_bgr = cv2.add(colored_part, background_gray)
    return result_bgr


# -------------------------------------------------------------
# 4. Smart Background Removal & Auto-Mask (คนที่ 4)
# -------------------------------------------------------------

def smart_remove_background(image_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    ตัดฉากหลังอัตโนมัติด้วย GrabCut และปรับเกลี่ยขอบ Mask ด้วย Morphology Close (Lecture 10, 11)
    Optimization:
      - ย่อขนาดภาพสำหรับการคำนวณ GrabCut หากด้านยาวเกิน 512px เพื่อเร่งความเร็วจาก ~50s เหลือ < 1s
      - ขยาย Mask กลับมาเท่าขนาดภาพจริง เพื่อให้ได้ภาพความละเอียดสูง 100%
    ส่งคืน:
      - rgba: ภาพวัตถุตัดฉากหลังโปร่งใส (4 Channels: BGRA)
      - clean_mask: ภาพ Binary Mask ขาว-ดำ (1 Channel: 255=ตัวแบบ, 0=ฉากหลัง)
    """
    orig_h, orig_w = image_bgr.shape[:2]

    # ย่อสเกลสำหรับ GrabCut (คง Aspect Ratio, ด้านยาวไม่เกิน 512 px)
    max_dim = 512
    scale = min(1.0, max_dim / max(orig_h, orig_w))
    if scale < 1.0:
        small_w = int(orig_w * scale)
        small_h = int(orig_h * scale)
        small_img = cv2.resize(image_bgr, (small_w, small_h), interpolation=cv2.INTER_AREA)
    else:
        small_img = image_bgr
        small_w, small_h = orig_w, orig_h

    mask = np.zeros((small_h, small_w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    # กรอบ Bounding Box เว้นขอบ 5%
    rect = (
        int(small_w * 0.05),
        int(small_h * 0.05),
        max(1, int(small_w * 0.9)),
        max(1, int(small_h * 0.9))
    )

    cv2.grabCut(
        small_img,
        mask,
        rect,
        bgd_model,
        fgd_model,
        iterCount=5,
        mode=cv2.GC_INIT_WITH_RECT
    )

    # แปลงผลลัพธ์: 0=GC_BGD, 2=GC_PR_BGD เป็น 0 (ฉากหลัง), นอกนั้นเป็น 255 (วัตถุ)
    small_binary = np.where((mask == cv2.GC_BGD) | (mask == cv2.GC_PR_BGD), 0, 255).astype("uint8")

    # ปรับเรียบขอบและลบรอยแหว่งด้วย Morphology Close
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    small_clean = cv2.morphologyEx(small_binary, cv2.MORPH_CLOSE, kernel)

    # ขยาย Mask กลับขึ้นมาเท่าภาพจริง
    if scale < 1.0:
        clean_mask = cv2.resize(small_clean, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        clean_mask = np.where(clean_mask >= 128, 255, 0).astype("uint8")
    else:
        clean_mask = small_clean

    # รวมเป็นภาพโปร่งใส RGBA (BGRA ใน OpenCV)
    b, g, r = cv2.split(image_bgr)
    rgba = cv2.merge([b, g, r, clean_mask])

    return rgba, clean_mask
