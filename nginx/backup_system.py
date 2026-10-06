"""
LUMA Distributed System - Automated DevOps Backup Tool
คนที่ 4: QA / DevOps - ระบบสำรองข้อมูลอัตโนมัติ (Automated Backup & Archive)
"""

import sys
import os
import shutil
import zipfile
import hashlib
import json
import urllib.request
from datetime import datetime
from pathlib import Path

# Configure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_NAME = f"LUMA_BACKUP_{TIMESTAMP}"
ZIP_PATH = BACKUP_DIR / f"{BACKUP_NAME}.zip"

def compute_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def fetch_system_snapshot():
    snapshot = {
        "timestamp": datetime.now().isoformat(),
        "nginx_gateway": "172.20.10.9:80",
        "frontend_node": "172.20.10.8:5500",
        "backend_node": "172.20.10.6:8000",
        "ai_server_node": "172.20.10.3:7860",
    }
    # Try fetching backend health
    try:
        req = urllib.request.Request("http://172.20.10.6:8000/healthz", headers={"User-Agent": "LumaBackup/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            snapshot["backend_health"] = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        snapshot["backend_health"] = {"error": str(e)}

    # Try fetching AI health
    try:
        req = urllib.request.Request("http://172.20.10.3:7860/ai/health", headers={"User-Agent": "LumaBackup/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            snapshot["ai_health"] = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        snapshot["ai_health"] = {"error": str(e)}

    return snapshot

def main():
    print("=" * 70)
    print("      LUMA PROJECT - DEVOPS AUTOMATED BACKUP UTILITY")
    print(f"      Role: คนที่ 4 (QA / DevOps) | Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    backup_items = []

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zipf:
        # 1. Nginx Config
        conf_file = BASE_DIR / "conf" / "nginx.conf"
        if conf_file.exists():
            zipf.write(conf_file, arcname="nginx_conf/nginx.conf")
            backup_items.append("Nginx Config (nginx.conf)")

        mime_file = BASE_DIR / "conf" / "mime.types"
        if mime_file.exists():
            zipf.write(mime_file, arcname="nginx_conf/mime.types")
            backup_items.append("Nginx MIME Types (mime.types)")

        # 2. Nginx Logs
        access_log = BASE_DIR / "logs" / "access.log"
        if access_log.exists():
            zipf.write(access_log, arcname="logs/access.log")
            backup_items.append(f"Access Log ({access_log.stat().st_size} bytes)")

        error_log = BASE_DIR / "logs" / "error.log"
        if error_log.exists():
            zipf.write(error_log, arcname="logs/error.log")
            backup_items.append("Error Log")

        # 3. Test Scripts & Reports
        test_py = BASE_DIR / "test_distributed_system.py"
        if test_py.exists():
            zipf.write(test_py, arcname="qa_test_suite/test_distributed_system.py")
            backup_items.append("Automated QA Test Suite")

        # 4. Dashboard File
        dash_html = BASE_DIR / "html" / "dashboard.html"
        if dash_html.exists():
            zipf.write(dash_html, arcname="dashboard/dashboard.html")
            backup_items.append("DevOps Monitoring Dashboard")

        # 5. Database File (if local)
        db_file = PROJECT_ROOT / "luma.db"
        if db_file.exists():
            zipf.write(db_file, arcname="database/luma.db")
            backup_items.append(f"SQLite Database ({round(db_file.stat().st_size / 1024, 1)} KB)")

        # 6. Live Cluster Telemetry Snapshot
        snapshot_data = fetch_system_snapshot()
        zipf.writestr("telemetry/cluster_snapshot.json", json.dumps(snapshot_data, indent=2, ensure_ascii=False))
        backup_items.append("Live 4-Node Cluster Telemetry Snapshot")

    zip_size_kb = round(ZIP_PATH.stat().st_size / 1024, 2)
    checksum = compute_sha256(ZIP_PATH)

    print("\n [BACKUP MANIFEST]")
    for item in backup_items:
        print(f"   [+] Backed up: {item}")

    print("\n" + "=" * 70)
    print(" [STATUS] BACKUP COMPLETED SUCCESSFULLY!")
    print(f" Destination Archive : {ZIP_PATH.name}")
    print(f" Archive Location    : {ZIP_PATH}")
    print(f" Archive Size        : {zip_size_kb} KB")
    print(f" SHA-256 Checksum    : {checksum}")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
