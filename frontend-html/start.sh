#!/usr/bin/env bash
# เปิด frontend ที่พอร์ต 5500 (ปิดตัวเก่าที่ค้างอยู่ให้ก่อน)
#
#   ./start.sh          โหมด gateway: รับเฉพาะคำขอจาก Nginx Gateway (ใช้ตอนเปิดระบบจริง)
#   ./start.sh local    โหมดทดสอบ: เปิดดูได้ที่ http://localhost:5500 บนเครื่องตัวเอง
#
# กด Ctrl + C เพื่อปิด
set -euo pipefail

PORT=5500
EXPECTED_IP="10.23.130.6"   # IP ที่ nginx.conf ของ Gateway ส่งต่อมา (upstream frontend_node)
GATEWAY_IP="10.23.130.212"
MODE="${1:-gateway}"

if [ "$MODE" != "local" ] && [ "$MODE" != "gateway" ]; then
  echo "ใช้: ./start.sh [local]" >&2
  exit 1
fi

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "ไม่พบ python3 — ติดตั้งก่อน (brew install python)" >&2
  exit 1
fi

# ปิดเซิร์ฟเวอร์เก่าที่ยังจับพอร์ตอยู่
OLD_PIDS="$(lsof -ti tcp:$PORT -sTCP:LISTEN || true)"
if [ -n "$OLD_PIDS" ]; then
  echo "ปิดเซิร์ฟเวอร์เก่าที่พอร์ต $PORT (pid $OLD_PIDS)"
  kill $OLD_PIDS
  sleep 1
fi

# IP ของเครื่องนี้ ต้องตรงกับที่ Gateway ตั้งไว้ ไม่งั้นหน้าเว็บผ่าน Gateway จะเปิดไม่ขึ้น
MY_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '?')"
echo "IP เครื่องนี้: $MY_IP"
if [ "$MODE" != "local" ] && [ "$MY_IP" != "$EXPECTED_IP" ]; then
  echo "⚠️  Gateway ส่งต่อมาที่ $EXPECTED_IP แต่เครื่องนี้เป็น $MY_IP"
  echo "   ต่อ Wi-Fi ของทีม หรือบอกฝั่ง devops ให้แก้ upstream frontend_node ใน nginx.conf"
fi

case "$MODE" in
  local)
    echo "โหมดทดสอบ → เปิด http://localhost:$PORT"
    exec python3 -m http.server "$PORT" --bind 0.0.0.0
    ;;
  gateway)
    echo "โหมด gateway → ผู้ใช้เข้าที่ http://$GATEWAY_IP (เข้าตรงพอร์ต $PORT จะได้ 403)"
    exec python3 serve_gateway.py
    ;;
esac
