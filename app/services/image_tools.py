"""
Image Processing Tools Service
รวบรวมฟังก์ชันประมวลผลภาพทั้ง 4 ฟังก์ชันสำหรับ Creative Studio (LUMA):
1. MediaPipe Pose Detection: สกัดโครงสร้างสรีระร่างกาย 33 จุด
2. Artistic Pencil Sketch: แปลงภาพเป็นลายเส้นดินสอด้วย Color Dodge Blend
3. Color Splash Filter: ดูดสีเด่น (Red/Green) รอบข้างเป็น Grayscale
4. Smart Background Removal: ตัดฉากหลังด้วย GrabCut + Morphology พร้อมสร้าง Inpaint Mask
"""

import io
import os
import uuid
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional

import cv2
import numpy as np
from PIL import Image

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
    - รองรับภาพ RGBA โดยทำการ Composite ทับพื้นหลังสีขาวเพื่อความคมชัด
    - รองรับภาพ Grayscale โดยแปลงเป็น 3-Channel BGR
    - ถอดรหัสจากเนื้อหาจริง (Magic Bytes) ไม่พึ่งพานามสกุลไฟล์
    """
    nparr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError("Cannot decode image data. Corrupted or unsupported format.")

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


def load_image_from_url_or_path(url_or_path: str) -> np.ndarray:
    """
    อ่านภาพจาก local path หรือ URL ภายในระบบ LUMA (/outputs/..., /uploads/...)
    """
    path_str = url_or_path.strip()

    # จัดการกรณีเป็น URL ภายในระบบ เช่น http://localhost:8000/outputs/... หรือ /outputs/...
    if "://" in path_str:
        # ตัด scheme และ domain ออก เอาเฉพาะ path
        from urllib.parse import urlparse
        path_str = urlparse(path_str).path

    # แมปเข้ากับโฟลเดอร์จริงบน Disk
    if path_str.startswith("/outputs/") or path_str.startswith("outputs/"):
        rel_path = path_str.lstrip("/")
        full_path = BASE_DIR / rel_path
    elif path_str.startswith("/uploads/") or path_str.startswith("uploads/"):
        rel_path = path_str.lstrip("/")
        full_path = BASE_DIR / rel_path
    elif path_str.startswith("/generations/") and "/image" in path_str:
        # กรณีเป็น URL /generations/{id}/image
        parts = path_str.strip("/").split("/")
        gen_id = parts[1]
        # ค้นหาภาพใน outputs/{gen_id}
        candidate_dir = BASE_DIR / "outputs" / gen_id
        images = list(candidate_dir.glob("*.png")) + list(candidate_dir.glob("*.jpg"))
        if not images:
            raise FileNotFoundError(f"Generated image not found for generation ID: {gen_id}")
        full_path = images[0]
    else:
        full_path = Path(path_str)
        if not full_path.is_absolute():
            full_path = BASE_DIR / full_path

    if not full_path.exists():
        raise FileNotFoundError(f"Image file does not exist at: {full_path}")

    image_bgr = cv2.imread(str(full_path), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise ValueError(f"Failed to read image from path: {full_path}")
    return image_bgr


def save_tool_result(image_arr: np.ndarray, prefix: str = "result") -> Tuple[str, Path]:
    """
    บันทึกภาพผลลัพธ์เป็นไฟล์ PNG ลงใน outputs/tools/
    ส่งคืน (api_relative_url, absolute_path)
    """
    file_id = uuid.uuid4().hex
    filename = f"{prefix}_{file_id}.png"
    target_path = TOOLS_OUTPUT_DIR / filename

    # ถ้ามี 4 channels (BGRA) ให้บันทึกแบบ PNG Alpha
    cv2.imwrite(str(target_path), image_arr)
    relative_url = f"/api/tools/results/{filename}"
    return relative_url, target_path


# -------------------------------------------------------------
# 1. MediaPipe Pose Landmark Detection (คนที่ 1)
# -------------------------------------------------------------

def extract_pose_skeleton(image_bgr: np.ndarray) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    ตรวจจับท่าทางและสรีระ 33 จุด (MediaPipe Pose)
    - วาดเส้นโครงร่าง (Skeleton) และจุด Landmarks ลงบนภาพต้นฉบับ
    - ส่งออกรายการพิกัด JSON 33 จุด (id, name, x, y, z, visibility)
    """
    if mp is None:
        raise RuntimeError("MediaPipe package is not installed.")

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
            # วาดเส้นและจุดลงบนภาพ
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
                connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
            )

            # สกัดพิกัดทั้ง 33 จุด
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

def generate_pencil_sketch(image_bgr: np.ndarray, blur_ksize: int = 21) -> np.ndarray:
    """
    แปลงภาพถ่าย/ภาพสีเป็นภาพลายเส้นดินสอ (Color Dodge Blend) จาก Lecture 9
    สูตร:
      1. Gray = cvtColor(BGR2GRAY)
      2. Invert = 255 - Gray
      3. Blur = GaussianBlur(Invert, (k, k), 0)
      4. Sketch = cv2.divide(Gray, 255 - Blur, scale=256)
    """
    # ปรับ ksize ให้เป็นเลขคี่และอย่างน้อย 3
    if blur_ksize % 2 == 0:
        blur_ksize += 1
    blur_ksize = max(3, blur_ksize)

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    inv_gray = cv2.bitwise_not(gray)
    blurred = cv2.GaussianBlur(inv_gray, (blur_ksize, blur_ksize), 0)
    sketch_gray = cv2.divide(gray, 255 - blurred, scale=256)

    # แปลงกลับเป็น BGR เพื่อความสม่ำเสมอของผลลัพธ์
    sketch_bgr = cv2.cvtColor(sketch_gray, cv2.COLOR_GRAY2BGR)
    return sketch_bgr


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
    ส่งคืน:
      - rgba: ภาพวัตถุตัดฉากหลังโปร่งใส (4 Channels)
      - clean_mask: ภาพ Binary Mask ขาว-ดำ (1 Channel) สำหรับ Inpainting Canvas
    """
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    # กรอบ Bounding Box เว้นขอบ 5%
    rect = (
        int(w * 0.05),
        int(h * 0.05),
        max(1, int(w * 0.9)),
        max(1, int(h * 0.9))
    )

    cv2.grabCut(
        image_bgr,
        mask,
        rect,
        bgd_model,
        fgd_model,
        iterCount=5,
        mode=cv2.GC_INIT_WITH_RECT
    )

    # แปลงผลลัพธ์: 0=GC_BGD, 2=GC_PR_BGD เป็น 0 (ฉากหลัง), นอกนั้นเป็น 255 (วัตถุ)
    binary_mask = np.where((mask == cv2.GC_BGD) | (mask == cv2.GC_PR_BGD), 0, 255).astype("uint8")

    # ปรับเรียบขอบและลบรอยแหว่งด้วย Morphology Close
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel)

    # รวมเป็นภาพโปร่งใส RGBA (BGRA ใน OpenCV)
    b, g, r = cv2.split(image_bgr)
    rgba = cv2.merge([b, g, r, clean_mask])

    return rgba, clean_mask
