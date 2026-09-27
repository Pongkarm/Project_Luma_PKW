"""
=============================================================================
LUMA Distributed AI Inference Node — Image Processing & WebP Optimizer
=============================================================================
ไฟล์นี้จัดการการแปลงและการประมวลผลไฟล์ภาพในหน่วยความจำ (RAM/VRAM):
1. ถอดรหัสภาพจาก Base64 (Data URL หรือ Plain Base64) เป็น PIL Image
2. เข้ารหัสและบีบอัดภาพเป็นฟอร์แมต WebP คุณภาพสูง (Quality 92, Method 6)
   เพื่อลดขนาดภาพลง ~80% เมื่อเทียบกับ PNG ดั้งเดิม
3. ปรับขนาดภาพ (Resolution Guard) ให้อยู่ในขอบเขต 256px - 768px
   และบังคับให้ขนาดกว้างxยาว "หารด้วย 8 ลงตัวเสมอ" ตามสเปกของ Stable Diffusion Latent Space
=============================================================================
"""

import io
import base64
from PIL import Image
from ai_server.config import AIConfig


def decode_base64_to_image(b64_string: str) -> Image.Image:
    """
    แปลงข้อความ Base64 กลับเป็น PIL Image:
    - รองรับทั้ง Data URI Scheme (เช่น 'data:image/png;base64,iVBORw...')
      และ Raw Base64 String ธรรมดา
    - บังคับแปลง Color Mode เป็น RGB เพื่อป้องกันปัญหาภาพติด Alpha Channel (RGBA)
      ซึ่งอาจทำให้โมเดล Diffusion คำนวณสีผิดเพี้ยน
    """
    # ตัด Header ของ Data URL ออกหากมี เช่น "data:image/jpeg;base64,"
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
        
    image_bytes = base64.b64decode(b64_string)
    image = Image.open(io.BytesIO(image_bytes))
    return image.convert("RGB")


def encode_image_to_base64(
    image: Image.Image, 
    format: str = "WEBP", 
    quality: int = AIConfig.WEBP_QUALITY
) -> str:
    """
    แปลง PIL Image เป็น Data URL Base64 ที่บีบอัดเป็น WebP:
    - format="WEBP": ฟอร์แมตรูปภาพสมัยใหม่ที่ให้ความคมชัดสูงในขนาดไฟล์ที่เล็กมาก
    - quality=92: ให้คุณภาพใกล้เคียง Lossless แต่ขนาดไฟล์ลดลงเฉลี่ย 70-80% เมื่อเทียบกับ PNG
    - method=6: ใช้อัลกอริทึมบีบอัดระดับลึกที่สุดของ libwebp เพื่อให้ได้ขนาดที่ประหยัดที่สุด
    """
    buffer = io.BytesIO()
    image.save(buffer, format=format, quality=quality, method=6)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{encoded}"


def enforce_max_resolution(
    image: Image.Image, 
    min_dim: int = AIConfig.MIN_IMAGE_WIDTH, 
    max_dim: int = AIConfig.MAX_IMAGE_WIDTH
) -> Image.Image:
    """
    ปรับขนาดภาพต้นฉบับให้อยู่ในขอบเขตที่ปลอดภัยต่อ VRAM:
    
    หลักการทาง Image Processing สำหรับ Stable Diffusion:
    1. ป้องกัน OOM: หากภาพใหญ่เกิน 768px จะทำการย่อสัดส่วนลงมาโดยรักษา Aspect Ratio เดิม
    2. กฎหารด้วย 8 ลงตัว (Divisible by 8): 
       ตัวเข้ารหัส VAE (Variational Autoencoder) ของ Stable Diffusion ทำการบีบอัดภาพ
       ลงสู่ Latent Space ด้วยอัตราส่วน 8 เท่า (Downsample factor = 8)
       ดังนั้น ขนาดภาพ Pixel ต้องหารด้วย 8 ลงตัวเสมอ (เช่น 512, 576, 768)
       หากไม่หารด้วย 8 ลงตัว จะเกิดขอบภาพเพี้ยน หรือเกิด Exception ใน Tensor Operation
    3. Lanczos Resampling: ใช้ฟิลเตอร์ Lanczos คุณภาพสูงในการปรับขนาดเพื่อคงรายละเอียดของเส้น
    """
    w, h = image.size
    
    # กรณีภาพเล็กกว่าขอบเขตขั้นต่ำ (ต่ำกว่า 256px) ให้ขยายขึ้นตามสัดส่วน
    if w < min_dim or h < min_dim:
        ratio = max(min_dim / max(w, 1), min_dim / max(h, 1))
        w = int(w * ratio)
        h = int(h * ratio)
    # กรณีภาพใหญ่กว่าขอบเขตสูงสุด (เกิน 768px) ให้ย่อลงตามสัดส่วน
    elif w > max_dim or h > max_dim:
        ratio = min(max_dim / w, max_dim / h)
        w = int(w * ratio)
        h = int(h * ratio)
    
    # บังคับปัดเศษให้หารด้วย 8 ลงตัว
    new_w = max((w // 8) * 8, min_dim)
    new_h = max((h // 8) * 8, min_dim)
    new_w = min(new_w, max_dim)
    new_h = min(new_h, max_dim)
    
    # หากขนาดเปลี่ยนไป ให้ทำการ Resize ด้วย Lanczos Resampling
    if (new_w, new_h) != image.size:
        return image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return image
