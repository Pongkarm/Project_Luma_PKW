# ai_server/utils/cache_manager.py — Automatic Storage Cache Cleanup Policy
import os
import time
from ai_server.config import AIConfig

def cleanup_stale_cache(max_age_days: int = 7, max_size_mb: int = 500):
    """
    Purges cached generation files older than max_age_days or if directory exceeds max_size_mb.
    Prevents storage leaks during long-running server operation.
    """
    cache_dir = AIConfig.CACHE_DIR
    if not os.path.exists(cache_dir):
        return

    now = time.time()
    max_age_seconds = max_age_days * 86400

    total_size = 0
    files = []

    for f in os.listdir(cache_dir):
        fpath = os.path.join(cache_dir, f)
        if os.path.isfile(fpath):
            stat = os.stat(fpath)
            total_size += stat.st_size
            files.append((fpath, stat.st_mtime, stat.st_size))

    # 1. Delete files older than max_age_days
    for fpath, mtime, size in files:
        if now - mtime > max_age_seconds:
            try:
                os.remove(fpath)
                total_size -= size
                print(f"[CACHE CLEANUP] Removed expired cache file: {os.path.basename(fpath)}")
            except Exception as e:
                print(f"[CACHE WARN] Failed to remove {fpath}: {e}")

    # 2. If directory still exceeds max_size_mb, remove oldest files
    max_bytes = max_size_mb * 1024 * 1024
    if total_size > max_bytes:
        # Sort by oldest modification time
        files.sort(key=lambda x: x[1])
        for fpath, _, size in files:
            if total_size <= max_bytes:
                break
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
                    total_size -= size
                    print(f"[CACHE CLEANUP] Evicted oldest file to free space: {os.path.basename(fpath)}")
            except Exception:
                pass
