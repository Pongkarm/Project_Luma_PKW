"""
LUMA Distributed System - End-to-End Verification Test Suite
ทดสอบการเชื่อมต่อและความพร้อมใช้งานของสถาปัตยกรรม Distributed System ทั้ง 4 เครื่อง
ตามสไลด์ของอาจารย์:
  Node 1: Nginx Gateway (Windows: 172.20.10.9:80)
  Node 2: Frontend (macOS: 172.20.10.8:5500)
  Node 3: Backend (macOS: 172.20.10.6:8000)
  Node 4: AI Server (Windows: 172.20.10.3:7860)
"""

import sys
import socket
import json
import urllib.request
import urllib.error
from datetime import datetime

# Configure UTF-8 for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ANSI Color Codes for terminal
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

NGINX_IP = "172.20.10.9"
FRONTEND_IP = "172.20.10.8"
BACKEND_IP = "172.20.10.6"
AI_IP = "172.20.10.3"

FRONTEND_PORT = 5500
BACKEND_PORT = 8000
AI_PORT = 7860
NGINX_PORT = 80

total_tests = 0
passed_tests = 0
failed_tests = 0

def write_header(title):
    print(f"\n{CYAN}{'=' * 80}{RESET}")
    print(f"{CYAN} {title}{RESET}")
    print(f"{CYAN}{'=' * 80}{RESET}")

def report_result(tc_id, name, passed, detail=""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f" [{tc_id}] {GREEN}[PASS]{RESET} - {BOLD}{name}{RESET}")
        if detail:
            print(f"        Detail: {detail}")
    else:
        failed_tests += 1
        print(f" [{tc_id}] {RED}[FAIL]{RESET} - {YELLOW}{name}{RESET}")
        if detail:
            print(f"        Error: {RED}{detail}{RESET}")

def test_tcp_port(ip, port, timeout=1.0):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((ip, port))
        sock.close()
        return True
    except Exception:
        return False

def http_get(url, timeout=3.0, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "LumaTestRunner/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
            return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="ignore")
        return e.code, content
    except Exception as e:
        return 0, str(e)

def main():
    print(f"{MAGENTA}{'=' * 80}{RESET}")
    print(f"{MAGENTA}{BOLD}    LUMA PROJECT - DISTRIBUTED SYSTEM AUTOMATED TEST SUITE{RESET}")
    print(f"{MAGENTA}    Architecture: Browser -> Nginx (Gateway) -> [Frontend | Backend] -> AI Node{RESET}")
    print(f"{MAGENTA}    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    print(f"{MAGENTA}{'=' * 80}{RESET}")

    # -------------------------------------------------------------------------
    # GROUP 1: SERVICE PORT REACHABILITY (TCP SYN/ACK)
    # -------------------------------------------------------------------------
    write_header("TEST GROUP 1: Service Port Availability (TCP Handshake)")

    # TC-01: Nginx Port 80
    ng_ok = test_tcp_port("127.0.0.1", NGINX_PORT) or test_tcp_port(NGINX_IP, NGINX_PORT)
    report_result("TC-01", f"Nginx Gateway (Port {NGINX_PORT}) Listening", ng_ok, f"Host: {NGINX_IP}:{NGINX_PORT}")

    # TC-02: Frontend Port 5500
    fe_ok = test_tcp_port(FRONTEND_IP, FRONTEND_PORT)
    report_result("TC-02", f"Frontend Web Server (Port {FRONTEND_PORT}) Listening", fe_ok, f"Host: {FRONTEND_IP}:{FRONTEND_PORT} (macOS)")

    # TC-03: Backend Port 8000
    be_ok = test_tcp_port(BACKEND_IP, BACKEND_PORT)
    report_result("TC-03", f"Backend FastAPI Server (Port {BACKEND_PORT}) Listening", be_ok, f"Host: {BACKEND_IP}:{BACKEND_PORT} (macOS)")

    # TC-04: AI Server Port 7860
    ai_ok = test_tcp_port(AI_IP, AI_PORT)
    report_result("TC-04", f"AI Server GPU Node (Port {AI_PORT}) Listening", ai_ok, f"Host: {AI_IP}:{AI_PORT} (Windows)")

    # -------------------------------------------------------------------------
    # GROUP 2: DIRECT NODE TELEMETRY & HEALTH
    # -------------------------------------------------------------------------
    write_header("TEST GROUP 2: Direct Node Service Healthchecks")

    # TC-05: AI Server Telemetry
    code, body = http_get(f"http://{AI_IP}:{AI_PORT}/ai/health")
    if code == 200:
        try:
            data = json.loads(body)
            gpu_device = data.get("gpu", {}).get("device", "Unknown GPU")
            vram_free = data.get("gpu", {}).get("vram_free_gb", 0)
            report_result("TC-05", "AI Node GPU Health & Telemetry", True, f"Status: online, GPU: {gpu_device}, Free VRAM: {vram_free} GB")
        except Exception as e:
            report_result("TC-05", "AI Node GPU Health & Telemetry", False, f"JSON parse error: {e}")
    else:
        report_result("TC-05", "AI Node GPU Health & Telemetry", False, f"HTTP {code} ({body[:60]})")

    # TC-06: Backend Health & Database Connection
    code, body = http_get(f"http://{BACKEND_IP}:{BACKEND_PORT}/healthz")
    if code == 200:
        try:
            data = json.loads(body)
            db_status = data.get("database", "unknown")
            service = data.get("service", "LUMA Backend")
            report_result("TC-06", "Backend API and SQLite Database Connection", db_status == "connected", f"Database: {db_status}, Service: {service}")
        except Exception as e:
            report_result("TC-06", "Backend API and SQLite Database Connection", False, f"JSON parse error: {e}")
    else:
        report_result("TC-06", "Backend API and SQLite Database Connection", False, f"HTTP {code} ({body[:60]})")

    # TC-07: Frontend Web Assets
    code, body = http_get(f"http://{FRONTEND_IP}:{FRONTEND_PORT}/login.html")
    is_fe_ok = (code == 200 and "<html" in body.lower())
    report_result("TC-07", "Frontend Web Server Static Asset Delivery", is_fe_ok, f"HTTP {code}, Asset Size: {len(body)} bytes")

    # -------------------------------------------------------------------------
    # GROUP 3: NGINX REVERSE PROXY GATEWAY ROUTING
    # -------------------------------------------------------------------------
    write_header("TEST GROUP 3: Nginx Gateway Routing (The Unified Entry Point)")

    # TC-08: Nginx -> Frontend Proxy (Root /)
    code, body = http_get(f"http://{NGINX_IP}/")
    is_root_ok = (code == 200 and "<html" in body.lower())
    report_result("TC-08", "Nginx -> Frontend Reverse Proxy (GET /)", is_root_ok, f"HTTP {code} OK (Loaded from Frontend via Nginx Port 80)")

    # TC-09: Nginx -> Frontend Page Proxy (/login.html)
    code, body = http_get(f"http://{NGINX_IP}/login.html")
    is_login_ok = (code == 200 and "<html" in body.lower())
    report_result("TC-09", "Nginx -> Frontend Page Proxy (GET /login.html)", is_login_ok, f"HTTP {code} OK")

    # TC-10: Nginx -> Backend API Proxy (/healthz)
    code, body = http_get(f"http://{NGINX_IP}/healthz")
    try:
        data = json.loads(body)
        is_api_ok = (code == 200 and data.get("status") == "healthy")
        report_result("TC-10", "Nginx -> Backend API Proxy (GET /healthz)", is_api_ok, f"HTTP {code} OK, Body: {body.strip()}")
    except Exception:
        report_result("TC-10", "Nginx -> Backend API Proxy (GET /healthz)", False, f"HTTP {code} ({body[:60]})")

    # TC-11: Nginx -> Backend Route Integrity (/api/models)
    code, body = http_get(f"http://{NGINX_IP}/api/models")
    # /api/models requires auth, so HTTP 401 proves the route reached Backend and was rejected by Auth, NOT 404/502!
    if code == 401:
        report_result("TC-11", "Nginx -> Backend Route Integrity (GET /api/models)", True, "HTTP 401 Not Authenticated (Route correctly reached Backend)")
    elif code == 200:
        report_result("TC-11", "Nginx -> Backend Route Integrity (GET /api/models)", True, "HTTP 200 OK (Model catalogue returned)")
    else:
        report_result("TC-11", "Nginx -> Backend Route Integrity (GET /api/models)", False, f"HTTP {code} ({body[:60]})")

    # -------------------------------------------------------------------------
    # GROUP 4: GATEWAY ENFORCEMENT & SECURITY
    # -------------------------------------------------------------------------
    write_header("TEST GROUP 4: Security & Gateway Routing Enforcement")

    # TC-12: Frontend config.js enforcement
    code, body = http_get(f"http://{FRONTEND_IP}:{FRONTEND_PORT}/js/config.js")
    enforced = ("const API_BASE_URL = ''" in body or 'const API_BASE_URL = ""' in body or f"const API_BASE_URL = 'http://{NGINX_IP}'" in body)
    report_result("TC-12", "Frontend Routing Enforcement (config.js)", enforced, "API_BASE_URL directs traffic through Nginx Gateway")

    # -------------------------------------------------------------------------
    # SUMMARY REPORT
    # -------------------------------------------------------------------------
    print(f"\n{CYAN}{'=' * 80}{RESET}")
    print(f"{CYAN}{BOLD}                           VERIFICATION SUMMARY REPORT{RESET}")
    print(f"{CYAN}{'=' * 80}{RESET}")
    print(f" Total Test Cases Executed : {total_tests}")
    print(f" Passed Test Cases         : {GREEN}{passed_tests}{RESET}")
    print(f" Failed Test Cases         : {RED if failed_tests > 0 else GREEN}{failed_tests}{RESET}")

    pass_rate = round((passed_tests / total_tests) * 100, 1) if total_tests > 0 else 0
    print(f" Overall Pass Rate         : {GREEN if pass_rate == 100 else YELLOW}{pass_rate}%{RESET}")

    if failed_tests == 0:
        print(f"\n{GREEN}{BOLD} [CONGRATULATIONS] The LUMA Distributed Architecture is 100% OPERATIONAL!{RESET}")
        print(f"{GREEN} All 4 nodes are correctly communicating via the Nginx Reverse Proxy Gateway.{RESET}")
    else:
        print(f"\n{YELLOW}{BOLD} [NOTE] Some test cases failed. Please review the details above.{RESET}")
    print(f"{CYAN}{'=' * 80}\n{RESET}")

if __name__ == "__main__":
    main()
