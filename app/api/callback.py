import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.schemas.generation import AICallbackPayload, AICallbackResponse
from app.services import generation as generation_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Server Callbacks"])


def verify_callback_secret(
    x_luma_internal_secret: Optional[str] = Header(None, alias="X-LUMA-INTERNAL-SECRET")
):
    """
    ตรวจสอบ Shared Secret Header จาก AI Server เพื่อความปลอดภัย
    """
    expected_secret = settings.AI_CALLBACK_SECRET
    if not expected_secret:
        return
    
    if not x_luma_internal_secret or x_luma_internal_secret != expected_secret:
        logger.warning("Rejected callback with invalid or missing X-LUMA-INTERNAL-SECRET")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-LUMA-INTERNAL-SECRET header"
        )


@router.post("/api/callback", response_model=AICallbackResponse)
@router.post("/callback", response_model=AICallbackResponse)
def ai_callback(
    payload: AICallbackPayload,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(verify_callback_secret),
):
    """
    Endpoint รับผลลัพธ์ภาพที่ประมวลผลเสร็จแล้วจาก AI Server (Callback Mode)
    - ตรวจสอบ Secret Header
    - ป้องกันงานซ้ำด้วย Idempotency Check
    - บันทึกไฟล์ภาพแบบ Atomic Write
    - อัปเดตสถานะใน Database
    """
    status_code, callback_res = generation_service.process_ai_callback(db=db, payload=payload)
    response.status_code = status_code
    return callback_res
