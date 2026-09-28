import logging
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    Request,
    HTTPException,
    status
)
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.models import User
from app.schemas.tools import (
    PoseResponse,
    ToolBaseResponse,
    RemoveBgResponse,
    PoseLandmark,
)
from app.services import image_tools

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["Image Processing Studio Tools"])


async def _resolve_image_from_input(
    file: Optional[UploadFile],
    image_url: Optional[str],
    request: Request,
):
    """
    Helper สำหรับดึงภาพไม่ว่าจะส่งมาเป็น Multipart File, Form image_url, หรือ JSON Body
    """
    # 1. กรณีอัปโหลดเป็นไฟล์
    if file is not None and file.filename:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )
        try:
            return image_tools.load_image_from_bytes(content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid image format: {e}"
            )

    # 2. กรณีส่งมาเป็น Form image_url
    if image_url and image_url.strip():
        try:
            return image_tools.load_image_from_url_or_path(image_url)
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot load image: {e}"
            )

    # 3. กรณีส่งเป็น application/json
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            json_url = body.get("image_url")
            if json_url:
                return image_tools.load_image_from_url_or_path(json_url)
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Please provide an image either via 'file' upload or 'image_url' parameter."
    )


# -------------------------------------------------------------
# 1. POST /api/tools/pose (คนที่ 1: MediaPipe Pose)
# -------------------------------------------------------------
@router.post(
    "/pose",
    response_model=PoseResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect pose skeleton and extract 33 landmarks"
)
async def detect_pose(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    วิเคราะห์สรีระและท่าทาง 33 จุด (MediaPipe Pose)
    - วาดเส้นโครงกระดูก Overlay ทับบนภาพ
    - ส่งออกรายการพิกัด JSON 33 จุด
    """
    image_bgr = await _resolve_image_from_input(file, image_url, request)

    try:
        annotated_bgr, landmarks_data = image_tools.extract_pose_skeleton(image_bgr)
    except Exception as e:
        logger.exception("Pose detection failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pose detection error: {e}"
        )

    result_url, _ = image_tools.save_tool_result(annotated_bgr, prefix="pose")

    parsed_landmarks = [PoseLandmark(**lm) for lm in landmarks_data]

    return PoseResponse(
        success=True,
        tool="pose",
        result_image_url=result_url,
        landmarks=parsed_landmarks,
        metadata={"total_landmarks": len(parsed_landmarks)}
    )


# -------------------------------------------------------------
# 2. POST /api/tools/sketch (คนที่ 2: Artistic Pencil Sketch)
# -------------------------------------------------------------
@router.post(
    "/sketch",
    response_model=ToolBaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Convert image to artistic pencil sketch"
)
async def create_pencil_sketch(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    blur_ksize: int = Form(21),
    current_user: User = Depends(get_current_user),
):
    """
    แปลงภาพถ่าย/ภาพ AI เป็นภาพวาดลายเส้นดินสอด้วยเทคนิค Color Dodge Blend (Lecture 9)
    """
    # ตรวจสอบว่ามี blur_ksize ใน JSON body หรือไม่
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if "blur_ksize" in body:
                blur_ksize = int(body["blur_ksize"])
        except Exception:
            pass

    image_bgr = await _resolve_image_from_input(file, image_url, request)

    try:
        sketch_bgr = image_tools.generate_pencil_sketch(image_bgr, blur_ksize=blur_ksize)
    except Exception as e:
        logger.exception("Pencil sketch generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sketch processing error: {e}"
        )

    result_url, _ = image_tools.save_tool_result(sketch_bgr, prefix="sketch")

    return ToolBaseResponse(
        success=True,
        tool="sketch",
        result_image_url=result_url,
        metadata={"blur_ksize": blur_ksize}
    )


# -------------------------------------------------------------
# 3. POST /api/tools/color-splash (คนที่ 3: Color Splash & Mood Tint)
# -------------------------------------------------------------
@router.post(
    "/color-splash",
    response_model=ToolBaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Keep target color and make background grayscale"
)
async def create_color_splash(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    target_color: str = Form("green"),
    current_user: User = Depends(get_current_user),
):
    """
    ดูดสีเด่น (Red หรือ Green) ด้วย Color Space HSV ตาม Lecture 3 & Work 5
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            if "target_color" in body:
                target_color = str(body["target_color"])
        except Exception:
            pass

    image_bgr = await _resolve_image_from_input(file, image_url, request)

    try:
        splash_bgr = image_tools.apply_color_splash(image_bgr, target_color=target_color)
    except Exception as e:
        logger.exception("Color splash failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Color splash error: {e}"
        )

    result_url, _ = image_tools.save_tool_result(splash_bgr, prefix="splash")

    return ToolBaseResponse(
        success=True,
        tool="color-splash",
        result_image_url=result_url,
        metadata={"target_color": target_color}
    )


# -------------------------------------------------------------
# 4. POST /api/tools/remove-bg (คนที่ 4: Smart BG Removal & Auto-Mask)
# -------------------------------------------------------------
@router.post(
    "/remove-bg",
    response_model=RemoveBgResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove background with GrabCut and generate inpaint mask"
)
async def remove_background(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """
    ตัดฉากหลังโปร่งใส (RGBA) ด้วย GrabCut + Morphology Close
    และส่งออก Binary Mask ขาว-ดำ สำหรับใช้งานบน Inpainting Canvas (Lecture 10, 11)
    """
    image_bgr = await _resolve_image_from_input(file, image_url, request)

    try:
        rgba, clean_mask = image_tools.smart_remove_background(image_bgr)
    except Exception as e:
        logger.exception("Background removal failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Background removal error: {e}"
        )

    nobg_url, _ = image_tools.save_tool_result(rgba, prefix="nobg")
    mask_url, _ = image_tools.save_tool_result(clean_mask, prefix="mask")

    return RemoveBgResponse(
        success=True,
        tool="remove-bg",
        result_image_url=nobg_url,
        mask_image_url=mask_url,
        metadata={
            "method": "grabcut_morphology_close",
            "iterations": 5
        }
    )


# -------------------------------------------------------------
# 5. GET /api/tools/results/{filename} (ดาวน์โหลดไฟล์ผลลัพธ์)
# -------------------------------------------------------------
@router.get(
    "/results/{filename}",
    summary="Get processed tool result image"
)
def get_tool_result_image(filename: str):
    """
    เสิร์ฟไฟล์ภาพผลลัพธ์ของ Tools ให้กับ Frontend
    """
    # ป้องกัน Directory Traversal
    safe_filename = Path(filename).name
    file_path = image_tools.TOOLS_OUTPUT_DIR / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool result image not found."
        )

    # ตรวจสอบ media type
    media_type = "image/png" if file_path.suffix.lower() == ".png" else "image/jpeg"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"}
    )
