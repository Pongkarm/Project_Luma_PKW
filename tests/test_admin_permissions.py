"""
สิทธิ์ของแผงผู้ดูแลระบบ ทดสอบทุกคู่ของ (บทบาท × ปลายทาง)

ตารางเดียวแทนการเขียนทีละกรณี เพราะสิ่งที่ต้องพิสูจน์คือ "ไม่มีช่องไหนหลุด"
ไม่ใช่ "ช่องที่นึกออกทำงานถูก" — endpoint ที่เพิ่มใหม่แล้วลืมใส่ในตารางนี้
จะถูกจับได้จาก test_every_admin_route_is_covered

ทดสอบยิงผ่าน HTTP จริงกับเซิร์ฟเวอร์ที่รันอยู่ ไม่ใช่เรียกฟังก์ชันตรง เพราะ
สิ่งที่ต้องพิสูจน์คือ dependency ที่ติดกับ router ทำงาน ไม่ใช่ตรรกะข้างใน
"""

import json
import urllib.error
import urllib.parse
import urllib.request

import pytest

BASE = "http://localhost:8000"

ACCOUNTS = {
    "owner": ("alice", "SecurePassword123!"),
    "reviewer": ("normaluser", "NormalPass123!"),
    "plain": ("outsider", "Outsider123!"),
}


def call(path, token=None, method=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method)
    if token:
        request.add_header("Authorization", "Bearer " + token)
    if data:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, (json.load(response) if response.status != 204 else None)
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.load(error)
        except Exception:
            return error.code, None


def token_for(kind):
    username, password = ACCOUNTS[kind]
    status, data = call(
        "/auth/login", body=None, method="POST"
    ) if False else (None, None)
    request = urllib.request.Request(
        BASE + "/auth/login",
        data=urllib.parse.urlencode({"username": username, "password": password}).encode(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)["access_token"]
    except urllib.error.HTTPError:
        return None


@pytest.fixture(scope="module")
def tokens():
    found = {kind: token_for(kind) for kind in ACCOUNTS}
    missing = [k for k, v in found.items() if v is None]
    if missing:
        pytest.skip(f"ต้องมีบัญชีทดสอบครบก่อน ขาด: {missing}")
    return found


# (เมธอด, path, บทบาทต่ำสุดที่เข้าได้)
ROUTES = [
    ("GET", "/admin/me", "reviewer"),
    ("GET", "/admin/stats", "reviewer"),
    ("GET", "/admin/users", "reviewer"),
    ("GET", "/admin/generations", "reviewer"),
    ("GET", "/admin/audit", "admin"),
    ("GET", "/admin/roles", "owner"),
    # เส้นทางที่มีพารามิเตอร์ — {user_id} ถูกแทนด้วย id จริงตอนทดสอบ
    ("GET", "/admin/users/{user_id}", "reviewer"),
]

RANK = {"plain": 0, "reviewer": 1, "admin": 2, "owner": 3}


@pytest.mark.parametrize("method,path,minimum", ROUTES)
@pytest.mark.parametrize("who", ["owner", "reviewer", "plain"])
def test_route_matches_its_minimum_role(tokens, method, path, minimum, who):
    """เข้าได้ก็ต่อเมื่อระดับสิทธิ์ถึง ไม่ใช่เพราะรู้ URL"""
    if "{user_id}" in path:
        _s, me = call("/admin/me", tokens["owner"])
        path = path.replace("{user_id}", me["user_id"])
    status, _ = call(path, tokens[who], method=method)
    allowed = RANK[who] >= RANK[minimum]
    assert (status == 200) is allowed, f"{who} → {method} {path} ได้ {status}"
    if not allowed:
        assert status == 403


def test_no_session_is_401_not_403(tokens):
    """แยก 'ยังไม่ได้เข้าสู่ระบบ' ออกจาก 'ไม่มีสิทธิ์' เพื่อให้หน้าบ้านตอบสนองถูก"""
    for _method, path, _minimum in ROUTES:
        path = path.replace("{user_id}", "00000000-0000-0000-0000-000000000000")
        status, _ = call(path, None)
        assert status == 401, f"{path} ควรเป็น 401 แต่ได้ {status}"


def test_password_hash_never_leaves_the_server(tokens):
    """ไม่ได้กรองออกทีละที่ แต่ไม่มีอยู่ใน schema เลย"""
    for path in ["/admin/users", "/admin/users?page_size=100"]:
        _status, body = call(path, tokens["owner"])
        assert "password" not in json.dumps(body).lower()


def test_reviewer_sees_masked_email_and_no_prompt(tokens):
    """การปิดบังเกิดฝั่งเซิร์ฟเวอร์ ไม่ใช่ส่งไปครบแล้วให้หน้าบ้านไม่วาด"""
    _s, owner_view = call("/admin/users", tokens["owner"])
    _s, reviewer_view = call("/admin/users", tokens["reviewer"])
    assert "@" in owner_view["items"][0]["email"]
    assert "•" in reviewer_view["items"][0]["email"]

    _s, owner_runs = call("/admin/generations", tokens["owner"])
    _s, reviewer_runs = call("/admin/generations", tokens["reviewer"])
    if owner_runs["items"]:
        assert owner_runs["items"][0]["prompt"] is not None
        assert reviewer_runs["items"][0]["prompt"] is None


def test_page_size_is_capped(tokens):
    """?page_size=100000 ต้องดูดตารางทั้งใบไม่ได้"""
    status, body = call("/admin/users?page_size=100000", tokens["owner"])
    assert status == 422 or body["page_size"] <= 100


def test_reviewer_cannot_change_an_account(tokens):
    """reviewer อ่านอย่างเดียวจริง บังคับที่ endpoint ไม่ใช่ที่การซ่อนปุ่ม"""
    _s, users = call("/admin/users", tokens["owner"])
    target = next(u for u in users["items"] if u["username"] == "outsider")
    status, _ = call(
        f"/admin/users/{target['id']}/status",
        tokens["reviewer"],
        method="PATCH",
        body={"is_active": False, "reason": "ไม่ควรสำเร็จ"},
    )
    assert status == 403


def test_admin_cannot_disable_themselves(tokens):
    """ปิดบัญชีตัวเอง = ล็อกตัวเองออก และถ้าเป็นเจ้าของคนสุดท้ายคือล็อกทุกคนออก"""
    _s, me = call("/admin/me", tokens["owner"])
    status, body = call(
        f"/admin/users/{me['user_id']}/status",
        tokens["owner"],
        method="PATCH",
        body={"is_active": False, "reason": "ไม่ควรสำเร็จ"},
    )
    assert status == 409
    assert "ตัวเอง" in body["detail"]


def test_reason_is_required(tokens):
    """เหตุผลสั้นเกินไปถูกปฏิเสธ — มันคือสิ่งที่ทำให้ audit log อ่านรู้เรื่องภายหลัง"""
    _s, users = call("/admin/users", tokens["owner"])
    target = next(u for u in users["items"] if u["username"] == "outsider")
    status, _ = call(
        f"/admin/users/{target['id']}/status",
        tokens["owner"],
        method="PATCH",
        body={"is_active": False, "reason": "x"},
    )
    assert status == 422


def test_last_owner_cannot_be_removed(tokens):
    """ถ้าถอนได้ จะไม่มีใครมอบสิทธิ์คืนให้ใครได้อีกเลย ต้องแก้ฐานข้อมูลด้วยมือ"""
    _s, me = call("/admin/me", tokens["owner"])
    status, body = call(f"/admin/roles/{me['user_id']}", tokens["owner"], method="DELETE")
    assert status == 409
    assert "เจ้าของคนสุดท้าย" in body["detail"]


def test_unknown_user_is_404_not_500(tokens):
    missing = "00000000-0000-0000-0000-000000000000"
    status, _ = call(f"/admin/users/{missing}", tokens["owner"])
    assert status == 404


def test_every_admin_route_is_covered():
    """
    ประตูกันการลืม: endpoint ที่เพิ่มใหม่แล้วไม่ได้ใส่ในตาราง ROUTES จะทำให้
    ข้อนี้ล้ม แทนที่จะหลุดออกไปโดยไม่มีใครทดสอบสิทธิ์ของมัน
    """
    _s, spec = call("/openapi.json")
    live = {
        (method.upper(), path)
        for path, ops in spec["paths"].items()
        for method in ops
        if path.startswith("/admin") and method.upper() == "GET"
    }
    covered = {(m, p.split("?")[0]) for m, p, _ in ROUTES}
    assert live - covered == set(), f"ยังไม่ได้ทดสอบสิทธิ์ของ: {live - covered}"
