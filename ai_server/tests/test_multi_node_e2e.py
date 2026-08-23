# ai_server/tests/test_multi_node_e2e.py — Full Multi-Node (Backend + AI Server) Integration Test
import os
import sys
import time
import base64
import unittest
import asyncio
import threading
import httpx
import uvicorn

# Inject paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_REPO_PATH = r"C:\Users\kong\AppData\Local\Temp\repo_pkw"

sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, BACKEND_REPO_PATH)

from ai_server.server import app as ai_app
from ai_server.config import AIConfig

class MultiNodeIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure Backend Environment Variables
        os.environ["DATABASE_URL"] = "sqlite:///./test_multi_node_luma.db"
        os.environ["SECRET_KEY"] = "test-jwt-secret-key-12345"
        os.environ["AI_MODE"] = "callback"
        os.environ["AI_SERVER_CALLBACK_URL"] = "http://127.0.0.1:7860/ai/generate"
        os.environ["BACKEND_CALLBACK_URL"] = "http://127.0.0.1:8000/api/callback"
        os.environ["AI_CALLBACK_SECRET"] = AIConfig.INTERNAL_SECRET

        import main as backend_main
        cls.backend_app = backend_main.app

        # 1. Start AI Server on Port 7860
        cls.ai_server_config = uvicorn.Config(ai_app, host="127.0.0.1", port=7860, log_level="warning")
        cls.ai_server = uvicorn.Server(cls.ai_server_config)
        cls.ai_thread = threading.Thread(target=cls.ai_server.run, daemon=True)
        cls.ai_thread.start()

        # 2. Start Backend Server on Port 8000
        cls.backend_config = uvicorn.Config(cls.backend_app, host="127.0.0.1", port=8000, log_level="warning")
        cls.backend_server = uvicorn.Server(cls.backend_config)
        cls.backend_thread = threading.Thread(target=cls.backend_server.run, daemon=True)
        cls.backend_thread.start()

        # Wait for servers to spin up
        time.sleep(2.0)
        print("\n==================================================")
        print("🚀 Both AI Server (:7860) & Backend (:8000) Live!")
        print("==================================================")

    @classmethod
    def tearDownClass(cls):
        cls.ai_server.should_exit = True
        cls.backend_server.should_exit = True
        time.sleep(0.5)

    def test_01_full_multi_node_happy_path(self):
        """
        Tests the complete Multi-Node Happy Path:
        User -> Register -> Login -> POST /generations -> AI Server (:7860) -> Callback -> DB Complete -> View Image
        """
        with httpx.Client(base_url="http://127.0.0.1:8000", timeout=20.0) as client:
            # 1. Register User
            reg_payload = {
                "username": f"user_{int(time.time())}",
                "email": f"user_{int(time.time())}@example.com",
                "password": "Password123!"
            }
            reg_resp = client.post("/auth/register", json=reg_payload)
            self.assertIn(reg_resp.status_code, [200, 201], f"Register failed: {reg_resp.text}")
            print(f"[PASS] 1. User registered: {reg_payload['username']}")

            # 2. Login to obtain JWT Token
            login_resp = client.post(
                "/auth/login",
                data={"username": reg_payload["username"], "password": reg_payload["password"]},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            self.assertEqual(login_resp.status_code, 200, f"Login failed: {login_resp.text}")
            token = login_resp.json().get("access_token")
            self.assertTrue(token, "Access token missing")
            auth_headers = {"Authorization": f"Bearer {token}"}
            print(f"[PASS] 2. Login successful (JWT Token acquired)")

            # 3. Create Generation Task (txt2img + LoRA Frieren)
            gen_payload = {
                "task_type": "txt2img",
                "prompt": "1girl, frieren casting magic in crystal forest, detailed illustration",
                "negative_prompt": "blurry, low quality",
                "model_name": "counterfeitV30_v30.safetensors",
                "lora_config": {"id": "SousouNoFrieren_Frieren_IlluXL.safetensors", "weight": 0.85},
                "sampler_name": "Euler a",
                "steps": 25,
                "cfg_scale": 7.5,
                "width": 512,
                "height": 512
            }
            gen_resp = client.post("/generations", json=gen_payload, headers=auth_headers)
            self.assertIn(gen_resp.status_code, [200, 201], f"Generate task failed: {gen_resp.text}")
            task_data = gen_resp.json()
            task_id = task_data.get("id")
            self.assertTrue(task_id, "Task ID missing from generation response")
            print(f"[PASS] 3. Generation submitted to Backend: Task ID = {task_id}")

            # 4. Poll Backend until Task is completed via AI Server Callback
            print("[4] Polling Backend for AI Callback completion...")
            completed = False
            for attempt in range(1, 20):
                time.sleep(0.5)
                poll_resp = client.get(f"/generations/{task_id}", headers=auth_headers)
                self.assertEqual(poll_resp.status_code, 200)
                poll_data = poll_resp.json()
                status = poll_data.get("status")
                print(f"    Polling attempt {attempt}: Status = '{status}'")
                
                if status == "completed":
                    completed = True
                    break
                elif status == "failed":
                    self.fail(f"Task failed with error: {poll_data.get('error_message')}")

            self.assertTrue(completed, "Task did not complete within timeout")
            print(f"[PASS] 4. AI Server successfully executed task and completed Callback to Backend!")

            # 5. Fetch Generated Image from Backend
            img_resp = client.get(f"/generations/{task_id}/image", headers=auth_headers)
            self.assertEqual(img_resp.status_code, 200, "Failed to download image from backend")
            self.assertGreater(len(img_resp.content), 500, "Returned image is empty or invalid")
            print(f"[PASS] 5. Final image successfully served by Backend! Size: {len(img_resp.content)/1024:.2f} KB")

if __name__ == "__main__":
    unittest.main()
