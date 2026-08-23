# ai_server/utils/gpu_monitor.py
import torch
import gc

def get_gpu_status():
    """Returns real-time GPU and VRAM memory metrics."""
    if not torch.cuda.is_available():
        return {
            "status": "warning",
            "cuda_available": False,
            "device": "CPU",
            "vram_total_gb": 0.0,
            "vram_used_gb": 0.0,
            "vram_free_gb": 0.0
        }

    device_name = torch.cuda.get_device_name(0)
    total_mem = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    allocated_mem = torch.cuda.memory_allocated(0) / (1024 ** 3)
    reserved_mem = torch.cuda.memory_reserved(0) / (1024 ** 3)
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

def clear_vram_cache():
    """Forces VRAM garbage collection and cache release to prevent OOM."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
