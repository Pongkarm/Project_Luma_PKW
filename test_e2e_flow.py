"""
LUMA Backend Full Verification Test Suite (Phase 1 & Phase 2 + Image Upload & img2img)
ครอบคลุม:
1. GET /auth/me (Navbar & Profile)
2. Direct Mode Generation (POST /generate -> Inline Save)
3. Callback Security Check (X-LUMA-INTERNAL-SECRET validation)
4. Callback Idempotency Check (Duplicate callback handling)
5. Callback Mode End-to-End (POST /ai/generate -> Async Callback -> Completed)
6. Image Upload & img2img Pipeline End-to-End (POST /uploads -> POST /generations -> Completed)
"""
import io
import time
import httpx
import uuid
from PIL import Image
from app.core.config import settings

BACKEND_URL = "http://localhost:8000"
MOCK_AI_URL = "http://localhost:8001"
SECRET = settings.AI_CALLBACK_SECRET

def create_sample_png() -> bytes:
    img = Image.new("RGB", (300, 300), color=(70, 130, 180))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def run_tests():
    print("==================================================================")
    print("🧪 LUMA PHASE 2 + OPTION B (IMG2IMG) FULL VERIFICATION SUITE")
    print("==================================================================")

    # 1. Health Check
    res = httpx.get(f"{MOCK_AI_URL}/")
    assert res.status_code == 200, "Mock AI Server offline!"
    print(f"✅ 1. Mock AI Server is ONLINE on port 8001: {res.json()['modes']}")

    client = httpx.Client(base_url=BACKEND_URL, timeout=15.0)

    # 2. Register & Login
    username = f"tester_{uuid.uuid4().hex[:6]}"
    password = "SecurePassword123!"
    email = f"{username}@luma.ai"
    reg_res = client.post("/auth/register", json={"username": username, "email": email, "password": password})
    assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
    user_id = reg_res.json()["id"]
    print(f"✅ 2. Registered new user '{username}' (ID: {user_id})")

    login_res = client.post("/auth/login", data={"username": username, "password": password})
    assert login_res.status_code == 200, "Login failed!"
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    print(f"✅ 3. Logged in and received JWT Bearer Token")

    # 3. Test GET /auth/me
    me_res = client.get("/auth/me", headers=auth_headers)
    assert me_res.status_code == 200, f"GET /auth/me failed: {me_res.text}"
    profile = me_res.json()
    assert profile["username"] == username
    assert "password_hash" not in profile
    print(f"✅ 4. GET /auth/me verified! Data: username='{profile['username']}', total_generations={profile['total_generations']}")

    # 4. Test Direct Mode Generation (txt2img)
    print("\n--- 🔄 Testing Direct Mode (txt2img) ---")
    gen1_res = client.post("/generations", json={
        "prompt": "futuristic flying car over neon cyberpunk skyline",
        "task_type": "txt2img",
        "model_name": "counterfeitV30_v30.safetensors",
        "width": 512,
        "height": 512
    }, headers=auth_headers)
    assert gen1_res.status_code == 201, f"Direct gen failed: {gen1_res.text}"
    gen1_id = gen1_res.json()["id"]
    print(f"   Submitted job: {gen1_id} (Initial: {gen1_res.json()['status']})")

    time.sleep(1.5)
    status1_res = client.get(f"/generations/{gen1_id}", headers=auth_headers)
    assert status1_res.json()["status"] == "completed", f"Direct job status not completed: {status1_res.json()}"
    print(f"✅ 5. Direct Mode txt2img completed in {status1_res.json()['duration_seconds']}s!")

    img1_res = client.get(f"/generations/{gen1_id}/image", headers=auth_headers)
    assert img1_res.status_code == 200 and len(img1_res.content) > 0
    print(f"✅ 6. Downloaded image from Direct Mode ({len(img1_res.content)} bytes)")

    # 5. Test Callback Endpoint Security
    print("\n--- 🔐 Testing Callback Security & Idempotency ---")
    bad_secret_res = client.post("/api/callback", json={
        "task_id": str(uuid.uuid4()),
        "status": "completed",
        "image_base64": "dummy"
    }, headers={"X-LUMA-INTERNAL-SECRET": "wrong-secret"})
    assert bad_secret_res.status_code == 403, f"Expected 403 Forbidden, got {bad_secret_res.status_code}"
    print(f"✅ 7. Security Verified: Invalid secret rejected with HTTP 403 Forbidden!")

    # 6. Test Callback Mode End-to-End
    print("\n--- 📡 Testing Callback Mode (txt2img) End-to-End ---")
    gen2_res = client.post("/generations", json={
        "prompt": "serene anime garden with sakura blossoms and koi pond",
        "task_type": "txt2img",
        "model_name": "novaAnimeXL_ilV190.safetensors",
        "width": 512,
        "height": 512
    }, headers=auth_headers)
    assert gen2_res.status_code == 201
    gen2_id = gen2_res.json()["id"]
    print(f"   Created Job for Callback Test: {gen2_id}")

    mock_trigger_res = httpx.post(f"{MOCK_AI_URL}/ai/generate", json={
        "task_id": str(gen2_id),
        "prompt": "serene anime garden with sakura blossoms and koi pond",
        "model": "novaAnimeXL_ilV190.safetensors",
        "callback_url": f"{BACKEND_URL}/api/callback"
    }, headers={"X-LUMA-INTERNAL-SECRET": SECRET})
    assert mock_trigger_res.status_code == 202
    print(f"   Mock AI Accepted Job (202): {mock_trigger_res.json()['message']}")

    print("   Waiting for Mock AI to process and invoke POST /api/callback...")
    time.sleep(2.5)

    status2_res = client.get(f"/generations/{gen2_id}", headers=auth_headers)
    status2_data = status2_res.json()
    assert status2_data["status"] == "completed"
    print(f"✅ 8. Callback Mode Completed! Duration: {status2_data['duration_seconds']}s")

    img2_res = client.get(f"/generations/{gen2_id}/image", headers=auth_headers)
    assert img2_res.status_code == 200 and len(img2_res.content) > 0
    print(f"✅ 9. Image saved by Callback retrieved successfully ({len(img2_res.content)} bytes)")

    # 7. Test Idempotency
    dup_res = client.post("/api/callback", json={
        "task_id": str(gen2_id),
        "status": "completed",
        "image_base64": "dummy",
        "generation_time": 1.5
    }, headers={"X-LUMA-INTERNAL-SECRET": SECRET})
    assert dup_res.status_code == 200 and dup_res.json()["duplicate"] is True
    print(f"✅ 10. Idempotency Verified: Duplicate callback handled safely")

    # 8. Test Option B: Image Upload & img2img Pipeline
    print("\n--- 🎨 Testing Option B: Image Upload & img2img Pipeline ---")
    raw_img = create_sample_png()
    upload_res = client.post("/uploads", files={"file": ("input_sketch.png", raw_img, "image/png")}, headers=auth_headers)
    assert upload_res.status_code == 201
    upload_info = upload_res.json()
    print(f"✅ 11. Image Uploaded via POST /uploads (ID: {upload_info['file_id']}, Dimensions: {upload_info['width']}x{upload_info['height']})")

    # Check Static Serving
    static_res = client.get(upload_info["url"])
    assert static_res.status_code == 200
    assert "max-age=86400" in static_res.headers.get("cache-control", "")
    print(f"✅ 12. Static Image Served via {upload_info['url']} with 24h Cache-Control")

    # Submit img2img Job
    print("   Submitting img2img Job referencing uploaded image...")
    img2img_res = client.post("/generations", json={
        "prompt": "masterpiece anime oil painting of a castle on floating islands",
        "task_type": "img2img",
        "source_image_path": upload_info["url"],
        "denoising_strength": 0.7,
        "model_name": "counterfeitV30_v30.safetensors",
        "width": 512,
        "height": 512
    }, headers=auth_headers)
    assert img2img_res.status_code == 201
    img2img_id = img2img_res.json()["id"]
    print(f"   Created img2img Job ID: {img2img_id}")

    time.sleep(1.5)
    img2img_status = client.get(f"/generations/{img2img_id}", headers=auth_headers).json()
    assert img2img_status["status"] == "completed"
    print(f"✅ 13. img2img Job Completed in {img2img_status['duration_seconds']}s!")

    transformed_img = client.get(f"/generations/{img2img_id}/image", headers=auth_headers)
    assert transformed_img.status_code == 200 and len(transformed_img.content) > 0
    print(f"✅ 14. Downloaded transformed img2img result ({len(transformed_img.content)} bytes)")

    # 9. Verify Final Profile Total Generations
    me_final = client.get("/auth/me", headers=auth_headers).json()
    assert me_final["total_generations"] == 3
    print(f"✅ 15. Profile Total Generations accurately reflects: {me_final['total_generations']} jobs!")

    print("\n==================================================================")
    print("🏆 ALL FULL PIPELINE TESTS PASSED (15/15 TESTS 100% SUCCESS)!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
