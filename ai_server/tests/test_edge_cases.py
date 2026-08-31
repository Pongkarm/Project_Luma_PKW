# ai_server/tests/test_edge_cases.py — Senior Audit & Edge Case Test Suite
import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure ai_server is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai_server.server import app
from ai_server.config import AIConfig
from ai_server.services.queue_manager import task_queue

class TestEdgeCases(unittest.TestCase):
    def setUp(self):
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()
        self.valid_headers = {"X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET}

    def tearDown(self):
        self.client_ctx.__exit__(None, None, None)

    def test_01_empty_prompt_rejected(self):
        """Edge Case 1: Empty prompt should be rejected with HTTP 422"""
        payload = {"task_id": "test-empty", "prompt": ""}
        response = self.client.post("/ai/generate", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 422)
        print("\n[PASS] Edge Case 1: Empty prompt rejected (HTTP 422)")

    def test_02_oversized_prompt_rejected(self):
        """Edge Case 2: Prompt exceeding MAX_PROMPT_LENGTH (2000 chars) should be rejected with HTTP 422"""
        payload = {"task_id": "test-long", "prompt": "a" * (AIConfig.MAX_PROMPT_LENGTH + 1)}
        response = self.client.post("/ai/generate", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 422)
        print(f"[PASS] Edge Case 2: Prompt > {AIConfig.MAX_PROMPT_LENGTH} chars rejected (HTTP 422)")

    def test_03_excessive_steps_rejected(self):
        """Edge Case 3: Steps > 50 should be rejected to prevent GPU hogging"""
        payload = {"task_id": "test-steps", "prompt": "valid prompt", "steps": 100}
        response = self.client.post("/ai/generate", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 422)
        print("[PASS] Edge Case 3: Steps > 50 rejected (HTTP 422)")

    def test_04_unauthorized_request_forbidden(self):
        """Edge Case 4: Invalid internal secret should be rejected with HTTP 403"""
        payload = {"task_id": "test-auth", "prompt": "valid prompt"}
        bad_headers = {"X-LUMA-INTERNAL-SECRET": "wrong-secret-hacker"}
        response = self.client.post("/ai/generate", json=payload, headers=bad_headers)
        self.assertEqual(response.status_code, 403)
        print("[PASS] Edge Case 4: Invalid Secret blocked (HTTP 403)")

    def test_05_cancel_nonexistent_task(self):
        """Edge Case 5: Cancelling non-existent task returns HTTP 404"""
        response = self.client.delete("/ai/task/ghost-task-999", headers=self.valid_headers)
        self.assertEqual(response.status_code, 404)
        print("[PASS] Edge Case 5: Cancel non-existent task handled (HTTP 404)")

    def test_06_health_vram_audit(self):
        """Edge Case 6: Health check exposes structured VRAM metrics"""
        response = self.client.get("/ai/health")
        self.assertEqual(response.status_code, 200)
        gpu = response.json().get("gpu", {})
        self.assertIn("vram_total_gb", gpu)
        self.assertIn("vram_free_gb", gpu)
        self.assertIn("vram_used_gb", gpu)
        print(f"[PASS] Edge Case 6: VRAM Health Audited ({gpu['device']})")

    def test_07_edit_img2img_schema_acceptance(self):
        """Edge Case 7: Edit endpoint accepts img2img payload with LoRA, seed, sampler, denoising"""
        payload = {
            "task_id": "test-img2img-schema",
            "prompt": "1girl, cyberpunk jacket, neon background",
            "negative_prompt": "blurry, low quality",
            "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "mode": "img2img",
            "model_name": "counterfeitV30_v30.safetensors",
            "lora_config": {"id": "SousouNoFrieren_Frieren_IlluXL.safetensors", "weight": 0.85},
            "sampler_name": "Euler a",
            "seed": 123456,
            "denoising_strength": 0.65,
            "steps": 25,
            "cfg_scale": 7.0,
            "callback_url": "none"
        }
        response = self.client.post("/ai/edit", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 202)
        print("[PASS] Edge Case 7: Edit img2img schema accepted (HTTP 202)")

    def test_08_edit_inpaint_schema_acceptance(self):
        """Edge Case 8: Edit endpoint accepts inpaint payload with mask tensor and LoRA config"""
        payload = {
            "task_id": "test-inpaint-schema",
            "prompt": "magic crystal staff",
            "negative_prompt": "bad quality",
            "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "mask_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "mode": "inpaint",
            "model_name": "counterfeitV30_v30.safetensors",
            "lora_config": "SousouNoFrieren_Frieren_IlluXL.safetensors",
            "sampler_name": "DPM++ 2M Karras",
            "seed": 987654,
            "denoising_strength": 0.8,
            "steps": 30,
            "cfg_scale": 8.0,
            "callback_url": "none"
        }
        response = self.client.post("/ai/edit", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 202)
        print("[PASS] Edge Case 8: Edit inpaint schema accepted (HTTP 202)")

if __name__ == "__main__":
    unittest.main()
