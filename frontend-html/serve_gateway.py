"""เสิร์ฟ frontend ที่พอร์ต 5500 แต่ยอมรับเฉพาะคำขอที่มาจาก Nginx Gateway เท่านั้น

เข้าตรง http://<เครื่องนี้>:5500 จากเครื่องอื่น → 403 · เข้าผ่าน http://<gateway>/ → ใช้งานได้ปกติ
ส่งให้เฉพาะไฟล์ที่หน้าเว็บใช้ (หน้า .html, css/, js/) ไฟล์อื่น เช่น tests/ README.md → 404
และไม่แสดงรายชื่อไฟล์ในโฟลเดอร์
"""
import posixpath
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

NGINX_GATEWAY_IP = "10.23.130.212"
# เครื่อง Gateway มี IP ได้สองวงแลน ตรงกับ server_name ใน nginx.conf (branch devops)
ALLOWED_IPS = {NGINX_GATEWAY_IP, "172.20.10.9"}

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

    # หน้าเว็บโหลดแค่หน้า .html ที่อยู่บนสุด กับไฟล์ใน css/ และ js/ ที่เหลือไม่ต้องส่ง
    # normpath ก่อนเช็ค เพื่อกัน /js/../tests/lib.mjs
    def _public(self):
        path = posixpath.normpath(unquote(urlsplit(self.path).path))
        if path == "/" or path.startswith(("/css/", "/js/")):
            return True
        if posixpath.dirname(path) == "/" and path.endswith(".html"):
            return True
        self.send_error(HTTPStatus.NOT_FOUND)
        return False

    # ไม่แสดงรายชื่อไฟล์ เช่นเปิด /js/generate/ ตรง ๆ
    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def do_GET(self):
        if self._allowed() and self._public():
            super().do_GET()

    def do_HEAD(self):
        if self._allowed() and self._public():
            super().do_HEAD()


if __name__ == "__main__":
    port = 5500
    httpd = ThreadingHTTPServer(("0.0.0.0", port), GatewayOnlyHandler)
    print(f"Frontend running on :{port}. Accepting traffic ONLY via Nginx ({', '.join(sorted(ALLOWED_IPS))})...")
    httpd.serve_forever()
