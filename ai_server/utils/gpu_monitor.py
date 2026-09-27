"""
=============================================================================
LUMA Distributed AI Inference Node — GPU Telemetry & VRAM Memory Watchdog
=============================================================================
ไฟล์นี้ทำหน้าที่ตรวจสอบและบริหารจัดการหน่วยความจำบนการ์ดจอ (VRAM):
1. ตรวจสอบการมีอยู่ของฮาร์ดแวร์ NVIDIA GPU (RTX 3070 Laptop 8GB) ผ่าน PyTorch CUDA
2. คำนวณปริมาณหน่วยความจำ: Total, Allocated (ใช้งานจริง), Reserved (จองไว้), และ Free
3. ระบบเคลียร์ขยะ VRAM (Garbage Collection & Cache Purge) เพื่อป้องกันปัญหา CUDA OOM
=============================================================================
"""

import torch
import gc


def get_gpu_status() -> dict:
    """
    อ่านสถานะและสถิติหน่วยความจำ VRAM แบบ Real-time:
    
    Returns:
        dict: ข้อมูลสถานะ GPU ประกอบด้วยชื่ออุปกรณ์และขนาด VRAM ในหน่วย Gigabytes (GB)
    """
    # กรณีสภาพแวดล้อมไม่มี GPU หรือ PyTorch ไม่ได้คอมไพล์ร่วมกับ CUDA (Fallback)
    if not torch.cuda.is_available():
        return {
            "status": "warning",
            "cuda_available": False,
            "device": "CPU",
            "vram_total_gb": 0.0,
            "vram_used_gb": 0.0,
            "vram_free_gb": 0.0
        }

    # อ่านคุณสมบัติของฮาร์ดแวร์ GPU อุปกรณ์ที่ 0 (การ์ดจอหลัก RTX 3070)
    device_name = torch.cuda.get_device_name(0)
    
    # แปลงหน่วยจาก Bytes เป็น Gigabytes (GB): หารด้วย 1024^3
    total_mem = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    
    # Allocated Memory: หน่วยความจำ VRAM ที่ Tensor กำลังใช้งานอยู่จริงในขณะนั้น
    allocated_mem = torch.cuda.memory_allocated(0) / (1024 ** 3)
    
    # Reserved Memory: หน่วยความจำ VRAM ที่ PyTorch Caching Allocator จองพื้นที่ไว้ล่วงหน้า
    reserved_mem = torch.cuda.memory_reserved(0) / (1024 ** 3)
    
    # Free Memory: หน่วยความจำ VRAM ที่ยังคงว่างและสามารถจัดสรรให้งานใหม่ได้
    free_mem = total_mem - reserved_mem

    return {
        "status": "healthy",
        "cuda_available": True,
        "device": device_name,
        "vram_total_gb": round(total_mem, 2),
        "vram_used_gb": round(allocated_mem, 2),
        "vram_reserved_gb": round(reserved_mem, 2),
        "vram_free_gb": round(free_mem, 2)
    }


def clear_vram_cache() -> None:
    """
    ฟังก์ชันทำความสะอาด VRAM ฉุกเฉินเพื่อป้องกัน CUDA Out of Memory (OOM):
    
    กระบวนการทำงาน:
    1. gc.collect(): บังคับให้ Python ทำ Garbage Collection คืนหน่วยความจำอ็อบเจกต์ที่หมดอายุ
    2. torch.cuda.empty_cache(): คืนพื้นที่ Cache ที่ไม่ได้ใช้งานของ PyTorch กลับสู่ระบบปฏิบัติการ
    3. torch.cuda.ipc_collect(): เคลียร์ Inter-Process Communication Memory ที่อาจตกค้าง
    """
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
