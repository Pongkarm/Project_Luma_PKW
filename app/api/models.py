"""
Model catalogue proxy.

The AI node knows what checkpoints and LoRA adapters are actually on disk, but
the browser must not reach Node 3 directly — that separation is the whole point
of the three-node design. This forwards the question and hands back the answer,
so the frontend stops carrying a hardcoded copy that drifts every time someone
drops a new model into Stability Matrix.
"""
import logging
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.security import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["System"])

# The AI node rescans its model directories on every call, so a short cache
# keeps a busy Generate screen from turning into a disk-scan loop.
_CACHE_SECONDS = 60
_cache: dict[str, Any] = {"at": 0.0, "payload": None}


def _ai_models_url() -> str:
    """Derive the catalogue URL from whichever AI endpoint is configured."""
    base = settings.AI_SERVER_CALLBACK_URL or settings.AI_SERVER_URL
    for suffix in ("/ai/generate", "/ai/edit", "/generate"):
        if base.endswith(suffix):
            return base[: -len(suffix)] + "/ai/models"
    return base.rstrip("/") + "/ai/models"


@router.get("/api/models", summary="Checkpoints and LoRA adapters available on the AI node")
async def list_models(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    """
    Returns `{ checkpoints, loras, available }`.

    `available` is false when the AI node cannot be reached. The call still
    answers 200 with empty lists rather than an error: a model picker that
    cannot load its options is a degraded screen, not a broken request, and the
    frontend already knows how to fall back to its bundled list.
    """
    now = time.time()
    cached: Optional[dict[str, Any]] = _cache["payload"]
    if cached is not None and now - _cache["at"] < _CACHE_SECONDS:
        return cached

    url = _ai_models_url()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning(f"Could not read the model catalogue from {url}: {exc}")
        # Serve a stale answer rather than nothing if we ever had one.
        if cached is not None:
            return {**cached, "available": False}
        return {"checkpoints": [], "loras": [], "available": False}

    payload = {
        "checkpoints": data.get("checkpoints") or [],
        "loras": data.get("loras") or [],
        "available": True,
    }
    _cache["at"] = now
    _cache["payload"] = payload
    logger.info(
        f"Model catalogue refreshed | checkpoints={len(payload['checkpoints'])} "
        f"loras={len(payload['loras'])}"
    )
    return payload
