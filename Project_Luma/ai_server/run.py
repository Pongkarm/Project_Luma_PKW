# ai_server/run.py — Standalone Entry Point with auto sys.path resolution
import os
import sys

# Ensure Project Root is in Python Path regardless of current working directory
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn
from ai_server.config import AIConfig

if __name__ == "__main__":
    print(f"🚀 Starting LUMA AI Server from: {PROJECT_ROOT}")
    uvicorn.run(
        "ai_server.server:app",
        host=AIConfig.HOST,
        port=AIConfig.PORT,
        app_dir=PROJECT_ROOT,
        reload=True
    )
