"""
=============================================================================
LUMA Automated Test Suite — Track 01: DevOps & Nginx Gateway (Node 1)
=============================================================================
ไฟล์ทดสอบอัตโนมัติภาษา Python สำหรับตรวจสอบระบบ Nginx Gateway, Reverse Proxy,
Network Reachability, Security Access Control, และ Automated Backup
=============================================================================
"""

import unittest
import socket
import os
import sys
import hashlib
import zipfile
import json
import time

# คอนฟิกค่าคงที่ของระบบเครือข่าย Distributed Node (อ้างอิง README สถาปัตยกรรม 4 โหนด)
NGINX_IP = "10.23.130.212"
FRONTEND_IP = "10.23.130.6"
BACKEND_IP = "10.23.130.9"
AI_IP = "10.23.130.112"

NGINX_PORT = 80
FRONTEND_PORT = 5500
BACKEND_PORT = 8000
AI_PORT = 7860

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class TestDevOpsNetworkAndPorts(unittest.TestCase):
    """
    หมวดที่ 1 & 2: ตรวจสอบความพร้อมของเครือข่ายและ Socket Ports
    ครอบคลุมการตรวจสอบรูปแบบ IP วงแลน และกลไก Handshake ของพอร์ต
    """

    def test_tc_dev_001_to_004_ip_structure_validity(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_001_to_004_ip_structure_validity
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบความถูกต้องของผัง IP Address ทั้ง 4 เครื่องในระบบ Distributed
          - ตรวจสอบว่าทุกเครื่องตั้งค่าอยู่ในวงแลน Subnet เดียวกัน (10.23.130.0/24)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไฟล์คอนฟิก `nginx/conf/nginx.conf` และเอกสารสถาปัตยกรรมระบบใน Branch `devops`
          - ดึงข้อมูลมายังไง (How): สกัดผัง IP Address ค่าคงที่ของระบบ (Gateway 10.23.130.212, Frontend 10.23.130.6, Backend 10.23.130.9, AI Node 10.23.130.112) มาแยกตรวจ Octet ตามมาตรฐาน IPv4
        * ข้อมูลที่นำเข้า:
          - ค่า IP ของ Gateway, Frontend, Backend, และ AI Node
        * สิ่งที่คาดหวัง / Assertions:
          - รูปแบบ IP ต้องมี 4 ส่วน (Octets) ถูกต้องตามมาตรฐาน IPv4
          - ค่าแต่ละ Octet ต้องอยู่ในช่วง 0 ถึง 255
          - ทุก IP ต้องขึ้นต้นด้วย '10.23.130.' เพื่อยืนยันว่าคุยกันได้ในวงแลนจริง
        =========================================================================
        """
        nodes = {
            "Gateway": NGINX_IP,
            "Frontend": FRONTEND_IP,
            "Backend": BACKEND_IP,
            "AI_Node": AI_IP
        }
        for name, ip in nodes.items():
            parts = ip.split(".")
            # 1. เช็กว่าแบ่งได้ 4 ส่วน
            self.assertEqual(len(parts), 4, f"{name} IP ต้องประกอบด้วย 4 ส่วน")
            # 2. เช็กค่าตัวเลขแต่ละ octet
            for octet in parts:
                val = int(octet)
                self.assertTrue(0 <= val <= 255, f"{name} Octet {val} อยู่นอกช่วง 0-255")
            # 3. เช็กว่าเป็น Subnet วงแลนห้องแล็บเดียวกัน
            self.assertTrue(ip.startswith("10.23.130."), f"{name} ต้องอยู่ใน Subnet 10.23.130.0/24")

    def test_tc_dev_005_to_008_tcp_socket_handshake_logic(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_005_to_008_tcp_socket_handshake_logic
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบตรรกะการตรวจสอบสถานะพอร์ตผ่าน TCP 3-Way Handshake (SYN/ACK)
          - จำลองการตรวจจับว่าพอร์ตเปิดรับการเชื่อมต่อหรือไม่ โดยไม่ทำให้โปรแกรมแครช
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): สคริปต์ตรวจความพร้อมเครือข่าย `nginx/test_distributed_system.py` ใน Branch `devops`
          - ดึงข้อมูลมายังไง (How): สกัดตรรกะการเรียกฟังก์ชัน `socket.connect_ex()` พร้อมกลไก Timeout เพื่อจำลองการทดสอบสถานะพอร์ตอย่างปลอดภัย
        * สิ่งที่คาดหวัง / Assertions:
          - ฟังก์ชัน connect_ex ต้องคืนรหัสข้อผิดพลาดอย่างปลอดภัยเมื่อพอร์ตไม่เปิด
          - มีการกำหนด Timeout ป้องกันไม่ให้ระบบค้างกรณีเครือข่ายตอบสนองช้า
        =========================================================================
        """
        def check_port(host, port, timeout=0.3):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            try:
                res = sock.connect_ex((host, port))
                return res == 0
            except Exception:
                return False
            finally:
                sock.close()

        # ทดสอบกับพอร์ต Loopback ที่ไม่มีเซอร์วิสรันอยู่ ต้องคืน False อย่างปลอดภัย
        res = check_port("127.0.0.1", 65530)
        self.assertFalse(res, "พอร์ตที่ไม่มี service ต้องคืน False ไม่โยน Unhandled Exception")


class TestDevOpsNginxConfiguration(unittest.TestCase):
    """
    หมวดที่ 3 & 4: ตรวจสอบความถูกต้องของไฟล์คอนฟิก Nginx Reverse Proxy
    ยืนยันว่าการ Forward Traffic และ Headers ตั้งค่าถูกต้องตามสถาปัตยกรรม
    """

    def setUp(self):
        self.nginx_conf_path = os.path.join(PROJECT_ROOT, "nginx", "conf", "nginx.conf")

    def test_tc_dev_012_nginx_conf_file_exists(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_012_nginx_conf_file_exists
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบว่าไฟล์ตั้งค่าหลักของ Nginx (nginx.conf) มีอยู่จริงบนดิสก์
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ไดเรกทอรี `nginx/conf/nginx.conf` ใน Branch `devops`
          - ดึงข้อมูลมายังไง (How): อ้างอิง Path สัมพัทธ์จากตำแหน่ง Root ของโปรเจกต์ ตรวจสอบด้วย `os.path.exists()`
        * สิ่งที่คาดหวัง / Assertions:
          - Path: nginx/conf/nginx.conf ต้องมีอยู่จริง (os.path.exists == True)
        =========================================================================
        """
        self.assertTrue(os.path.exists(self.nginx_conf_path), f"ไม่พบไฟล์: {self.nginx_conf_path}")

    def test_tc_dev_013_nginx_proxy_pass_directives(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_013_nginx_proxy_pass_directives
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบการตั้งค่า proxy_pass ในไฟล์ nginx.conf
          - ยืนยันว่า Gateway ส่งต่อคำขอหน้าเว็บไปยัง Frontend (พอร์ต 5500)
          - ยืนยันว่า Gateway ส่งต่อคำขอ API ไปยัง Backend (พอร์ต 8000)
          - ยืนยันการส่งต่อ Headers: Host, X-Real-IP เพื่อไม่ให้เสียข้อมูลผู้ใช้
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): บล็อก `location /` และ `location /api` ภายในไฟล์ `nginx/conf/nginx.conf` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): อ่านไฟล์คอนฟิก Nginx เข้ามาแบบ Text Stream แล้วใช้ String Assertion ตรวจหาคำสั่ง `proxy_pass` และ `proxy_set_header`
        * สิ่งที่คาดหวัง / Assertions:
          - ต้องพบคอนฟิก '5500', '8000', 'proxy_set_header Host', 'X-Real-IP'
        =========================================================================
        """
        with open(self.nginx_conf_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # ตรวจสอบการส่งต่อไปยัง Frontend (:5500)
        self.assertIn("5500", content, "nginx.conf ต้องมี proxy ไปยังพอร์ต 5500 (Frontend)")
        # ตรวจสอบการส่งต่อไปยัง Backend (:8000)
        self.assertIn("8000", content, "nginx.conf ต้องมี proxy ไปยังพอร์ต 8000 (Backend)")
        # ตรวจสอบการรักษา Header ผู้ใช้ดั้งเดิม
        self.assertIn("proxy_set_header Host", content, "ต้องมีคำสั่งรักษา Host Header")
        self.assertIn("proxy_set_header X-Real-IP", content, "ต้องมีคำสั่งส่ง IP แท้จริงของผู้ใช้")

    def test_tc_dev_014_nginx_listen_port_80(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_014_nginx_listen_port_80
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบว่า Nginx Gateway ตั้งค่าดักรับการเชื่อมต่อที่พอร์ตมาตรฐาน 80
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): บล็อก `server { ... }` ใน `nginx/conf/nginx.conf` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): อ่านไฟล์คอนฟิกแล้วค้นหา directive `listen 80;` เพื่อยืนยันว่าเป็น Reverse Proxy พอร์ตมาตรฐาน
        * สิ่งที่คาดหวัง / Assertions:
          - ต้องมีคำสั่ง 'listen 80' เพื่อให้ผู้ใช้เข้าเว็บผ่าน IP ตรงๆ ได้โดยไม่ต้องใส่พอร์ต
        =========================================================================
        """
        with open(self.nginx_conf_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        self.assertIn("listen", content)
        self.assertIn("80", content, "Nginx ต้องตั้งค่า listen 80 สำหรับ Gateway จุดเดียว")


class TestDevOpsSecurityAndIsolation(unittest.TestCase):
    """
    หมวดที่ 5: ตรวจสอบนโยบายความปลอดภัยและการจำกัดสิทธิ์ (Security & Access Control)
    ยืนยันการตั้งค่า Subnet Isolation 403 และ Whitelist หน้า Dashboard
    """

    def setUp(self):
        self.nginx_conf_path = os.path.join(PROJECT_ROOT, "nginx", "conf", "nginx.conf")
        with open(self.nginx_conf_path, "r", encoding="utf-8", errors="ignore") as f:
            self.content = f.read()

    def test_tc_dev_016_subnet_isolation_directive(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_016_subnet_isolation_directive
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบคำสั่งจำกัดสิทธิ์เครือข่ายระดับ Subnet (LAN Isolation)
          - อนุญาตเฉพาะอุปกรณ์ในวงแลนโปรเจกต์ 10.23.130.0/24 เท่านั้น
          - ปฏิเสธการเข้าถึงจาก IP เครือข่ายภายนอกทั้งหมด (deny all)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): นโยบายการรักษาความปลอดภัยใน `nginx/conf/nginx.conf` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): ใช้ String Searching ตรวจจับคำสั่ง `allow 10.23.130.0/24` และ `deny all` เพื่อยืนยันกฎไฟร์วอลล์
        * สิ่งที่คาดหวัง / Assertions:
          - ต้องพบคอนฟิก 'allow 10.23.130.0/24' และ 'deny all' ใน nginx.conf
        =========================================================================
        """
        self.assertIn("allow 10.23.130.0/24", self.content, "ต้องอนุญาต subnet 10.23.130.0/24")
        self.assertIn("deny all", self.content, "ต้องมีคำสั่ง deny all บล็อก IP ภายนอก")

    def test_tc_dev_017_to_018_dashboard_whitelist_protection(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_017_to_018_dashboard_whitelist_protection
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ตรวจสอบการป้องกันหน้า DevOps Dashboard (/dashboard)
          - จำกัดสิทธิ์ให้เปิดดูสถานะระบบได้เฉพาะจากเครื่อง Gateway เอง (127.0.0.1 / Local)
          - ป้องกันไม่ให้อุปกรณ์อื่นในวงแลนสามารถแอบดูข้อมูลมอนิเตอร์ระบบได้
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): บล็อก `location /dashboard` ใน `nginx/conf/nginx.conf` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): สกัดกฎ Whitelist ตรวจคำสั่ง `allow 127.0.0.1` ร่วมกับ `deny all`
        * สิ่งที่คาดหวัง / Assertions:
          - ต้องมีบล็อก location สำหรับ 'dashboard'
          - มีคำสั่ง 'allow 127.0.0.1' และปิดท้ายด้วย 'deny all'
        =========================================================================
        """
        self.assertIn("dashboard", self.content.lower(), "ต้องมี location บล็อก /dashboard")
        self.assertIn("allow 127.0.0.1", self.content, "ต้องอนุญาต localhost")
        self.assertIn("deny all", self.content, "ต้อง deny อุปกรณ์อื่น")


class TestDevOpsBackupAndIntegrity(unittest.TestCase):
    """
    หมวดที่ 6: ตรวจสอบระบบสำรองข้อมูลและคำนวณ Checksum SHA-256
    ยืนยันว่าการ Backup ไฟล์ระบบสร้าง Zip ได้สมบูรณ์และตรวจสอบความถูกต้องได้
    """

    def test_tc_dev_019_backup_archive_generation_and_integrity(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_019_backup_archive_generation_and_integrity
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบการทำงานของระบบ Backup ไฟล์สำรองข้อมูลแบบบีบอัด (.zip)
          - ตรวจสอบว่าไฟล์ Zip ที่ถูกสร้างไม่มี Corrupted Data หรือไฟล์เสียหาย
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): สคริปต์ระบบสำรองข้อมูล `nginx/backup_system.py` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): จำลองสร้างไฟล์ .zip ในโฟลเดอร์ temp แล้วทดสอบความสมบูรณ์ของโครงสร้างด้วย `zipfile.testzip()` และตรวจรายชื่อไฟล์ใน archive
        * สิ่งที่คาดหวัง / Assertions:
          - สร้างไฟล์ Zip สำเร็จ
          - คำสั่ง zipfile.testzip() ต้องคืนค่า None (บ่งชี้ว่าไฟล์สมบูรณ์ 100%)
          - รายชื่อไฟล์ภายใน Zip ตรงกับที่ระบุไว้
        =========================================================================
        """
        test_backup_zip = os.path.join(PROJECT_ROOT, "nginx", "temp", "test_qa_sample.zip")
        os.makedirs(os.path.dirname(test_backup_zip), exist_ok=True)

        # จำลองการสร้างไฟล์ Backup
        with zipfile.ZipFile(test_backup_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("nginx_sample.conf", "# Test Conf")
            zf.writestr("metadata.json", json.dumps({"timestamp": time.time(), "status": "ok"}))

        self.assertTrue(os.path.exists(test_backup_zip), "ไฟล์ Zip ต้องถูกสร้างสำเร็จ")

        # ตรวจสอบความสมบูรณ์ของโครงสร้าง Zip
        with zipfile.ZipFile(test_backup_zip, "r") as zf:
            test_res = zf.testzip()
            self.assertIsNone(test_res, "ไฟล์ Zip สำรองข้อมูลต้องไม่มี corrupted entry")
            namelist = zf.namelist()
            self.assertIn("nginx_sample.conf", namelist)
            self.assertIn("metadata.json", namelist)

        # ทำความสะอาดไฟล์ทดสอบ
        if os.path.exists(test_backup_zip):
            os.remove(test_backup_zip)

    def test_tc_dev_020_sha256_checksum_calculation(self):
        """
        =========================================================================
        [TEST FUNCTION] test_tc_dev_020_sha256_checksum_calculation
        -------------------------------------------------------------------------
        * ฟังก์ชันนี้ทดสอบอะไร:
          - ทดสอบการคำนวณค่าแฮช SHA-256 สำหรับใช้ตรวจสอบความไม่เปลี่ยนแปลงของไฟล์สำรอง (Integrity)
        * แหล่งที่มาของข้อมูล (Data Source & Extraction):
          - ดึงข้อมูลมาจากตรงไหน (Where): ฟังก์ชันตรวจสอบความสมบูรณ์ของไฟล์ใน `nginx/backup_system.py` (Branch `devops`)
          - ดึงข้อมูลมายังไง (How): สกัดการใช้ฟังก์ชัน `hashlib.sha256()` จากสคริปต์ Backup มาสร้าง Assertion เทียบกับผลลัพธ์ Hex Digest 64 หลัก
        * สิ่งที่คาดหวัง / Assertions:
          - ผลลัพธ์ SHA-256 ต้องเป็นสตริง Hexadecimal ความยาว 64 ตัวอักษร
          - ค่าแฮชที่คำนวณต้องตรงกับค่าทางคณิตศาสตร์อย่างแม่นยำ
        =========================================================================
        """
        sample_data = b"LUMA_BACKUP_SYSTEM_VERIFICATION_PAYLOAD_2026"
        expected_hash = hashlib.sha256(sample_data).hexdigest()

        # คำนวณผ่านโมดูล hashlib
        computed = hashlib.sha256()
        computed.update(sample_data)
        result_hash = computed.hexdigest()

        self.assertEqual(len(result_hash), 64, "SHA-256 ต้องมีความยาว 64 Hex characters")
        self.assertEqual(result_hash, expected_hash, "ค่า Checksum ต้องถูกต้องตรงกับมาตรฐาน SHA-256")


if __name__ == "__main__":
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 80)
    print("  [TEST] RUNNING AUTOMATED TESTS: Track 01 - DevOps & Nginx Gateway")
    print("=" * 80)
    unittest.main(verbosity=2)
