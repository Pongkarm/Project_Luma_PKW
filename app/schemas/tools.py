from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PoseLandmark(BaseModel):
    id: int
    name: str
    x: float
    y: float
    z: float
    visibility: float


class ToolBaseResponse(BaseModel):
    success: bool = True
    tool: str
    result_image_url: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PoseResponse(ToolBaseResponse):
    landmarks: List[PoseLandmark] = Field(default_factory=list)


class RemoveBgResponse(ToolBaseResponse):
    mask_image_url: Optional[str] = None


class ToolJsonRequest(BaseModel):
    image_url: str = Field(..., description="URL หรือ Relative Path ของภาพในระบบ เช่น /outputs/... หรือ /uploads/...")


class SketchJsonRequest(ToolJsonRequest):
    blur_ksize: int = Field(default=21, description="ขนาด Gaussian Blur Kernel (เลขคี่ เช่น 21)")


class ColorSplashJsonRequest(ToolJsonRequest):
    target_color: str = Field(default="green", description="สีที่ต้องการคงไว้ ('green' หรือ 'red')")
