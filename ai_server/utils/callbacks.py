# ai_server/utils/callbacks.py
import asyncio
import os
import httpx
from ai_server.config import AIConfig

async def send_callback_with_retry(
    task_id: str,
    status: str,
    image_base64: str = None,
    error_message: str = None,
    generation_time: float = 0.0,
    callback_url: str = AIConfig.BACKEND_CALLBACK_URL
) -> bool:
    """
    Sends the generated image result back to the Flask Backend.
    Features 3-attempt exponential backoff retry for network resilience.
    """
    payload = {
        "task_id": task_id,
        "status": status,
        "image_base64": image_base64,
        "error": error_message,
        "generation_time": round(generation_time, 2)
    }

    headers = {
        "Content-Type": "application/json",
        "X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET
    }

    # If successful image, cache locally first (Disaster recovery protection)
    if image_base64 and status == "completed":
        try:
            os.makedirs(AIConfig.CACHE_DIR, exist_ok=True)
            cache_file = os.path.join(AIConfig.CACHE_DIR, f"{task_id}.webp.b64")
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(image_base64)
        except Exception as e:
            print(f"[CACHE WARN] Failed to write local cache: {e}")

    # If callback_url is None, empty, or "none", skip network delivery (used in tests)
    if not callback_url or str(callback_url).lower() in ["none", "null", ""]:
        print(f"[CALLBACK SKIP] No callback destination specified for task {task_id}.")
        return True

    # Retry loop with exponential backoff
    delays = [1.0, 2.0, 4.0]
    async with httpx.AsyncClient(timeout=15.0) as client:
        for attempt, delay in enumerate(delays, start=1):
            try:
                print(f"[CALLBACK] Attempt {attempt}/{len(delays)} -> {callback_url} (task: {task_id})")
                response = await client.post(callback_url, json=payload, headers=headers)
                if response.status_code in [200, 201, 204]:
                    print(f"[CALLBACK SUCCESS] Task {task_id} delivered successfully.")
                    return True
                else:
                    print(f"[CALLBACK WARN] Status {response.status_code}: {response.text}")
            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError) as exc:
                print(f"[CALLBACK ERROR] Attempt {attempt} failed: {exc}")

            if attempt < len(delays):
                await asyncio.sleep(delay)

    print(f"[CALLBACK FAILED] All retry attempts exhausted for task {task_id}.")
    return False
