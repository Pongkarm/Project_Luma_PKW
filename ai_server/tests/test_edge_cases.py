# ai_server/tests/test_edge_cases.py — Senior Audit & Edge Case Test Suite
import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure ai_server is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai_server.server import app
from ai_server.config import AIConfig

class TestEdgeCases(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.valid_headers = {"X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET}

    def test_01_empty_prompt_rejected(self):
        """Edge Case 1: Empty prompt should be rejected with HTTP 422"""
        payload = {"task_id": "test-empty", "prompt": ""}
        response = self.client.post("/ai/generate", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 422)
        print("\n[PASS] Edge Case 1: Empty prompt rejected (HTTP 422)")

    def test_02_oversized_prompt_rejected(self):
        """Edge Case 2: Prompt exceeding 500 characters should be rejected with HTTP 422"""
        payload = {"task_id": "test-long", "prompt": "a" * 501}
        response = self.client.post("/ai/generate", json=payload, headers=self.valid_headers)
        self.assertEqual(response.status_code, 422)
        print("[PASS] Edge Case 2: Prompt > 500 chars rejected (HTTP 422)")

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

if __name__ == "__main__":
    unittest.main()
