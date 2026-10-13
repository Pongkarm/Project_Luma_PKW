"""เสิร์ฟ frontend ที่พอร์ต 5500 แต่ยอมรับเฉพาะคำขอที่มาจาก Nginx Gateway เท่านั้น

เข้าตรง http://<เครื่องนี้>:5500 จากเครื่องอื่น → 403 · เข้าผ่าน http://<gateway>/ → ใช้งานได้ปกติ
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

NGINX_GATEWAY_IP = "10.23.130.212"
ALLOWED_IPS = {NGINX_GATEWAY_IP}

FORBIDDEN_HTML = f"""<!doctype html>
<html>
<head><meta charset="utf-8"><title>403 Forbidden</title></head>
<body style="font-family: sans-serif; text-align: center; padding-top: 60px; background: #0f172a; color: white;">
  <h1 style="color: #ef4444;">403 Forbidden</h1>
  <p><b>ไม่อนุญาตให้เข้าใช้งาน Frontend โดยตรง!</b></p>
  <p>ระบบสถาปัตยกรรม Distributed System บังคับให้เข้าผ่าน Nginx Gateway เท่านั้น:</p>
  <p><a href="http://{NGINX_GATEWAY_IP}" style="color: #38bdf8; font-size: 18px;">http://{NGINX_GATEWAY_IP}</a></p>
</body>
</html>""".encode("utf-8")


class GatewayOnlyHandler(SimpleHTTPRequestHandler):
    # เช็คจาก IP ต้นทางเท่านั้น ไม่เชื่อ header เพราะใครก็ส่ง header เองได้
    def _allowed(self):
        if self.client_address[0] in ALLOWED_IPS:
            return True
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(FORBIDDEN_HTML)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(FORBIDDEN_HTML)
        return False

    def do_GET(self):
        if self._allowed():
            super().do_GET()

    def do_HEAD(self):
        if self._allowed():
            super().do_HEAD()


if __name__ == "__main__":
    port = 5500
    httpd = ThreadingHTTPServer(("0.0.0.0", port), GatewayOnlyHandler)
    print(f"Frontend running on :{port}. Accepting traffic ONLY via Nginx ({NGINX_GATEWAY_IP})...")
    httpd.serve_forever()
