# ai_server/tests/test_server.py — Comprehensive Test Suite for AI Engineer
import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure ai_server is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai_server.server import app
from ai_server.config import AIConfig
from ai_server.services.prompt_builder import build_prompt_with_lora

class TestAIServer(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_01_health_check(self):
        """Test GET /ai/health endpoint and GPU VRAM detection"""
        response = self.client.get("/ai/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("gpu", data)
        print(f"\n[PASS] Health Check: GPU = {data['gpu']['device']} | VRAM Free = {data['gpu']['vram_free_gb']} GB")

    def test_02_list_models(self):
        """Test GET /ai/models endpoint scanning Stability Matrix models"""
        response = self.client.get("/ai/models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("checkpoints", data)
        self.assertIn("loras", data)
        print(f"[PASS] Models Listed: Found {data['total_checkpoints']} checkpoints, {data['total_loras']} LoRAs")

    def test_03_lora_trigger_injection(self):
        """Test Single Source of Truth LoRA trigger word injection"""
        raw_prompt = "a magical girl casting spell in a forest"
        lora_id = "SousouNoFrieren_Frieren_IlluXL.safetensors"
        enriched, lora_tag = build_prompt_with_lora(raw_prompt, lora_id)
        
        self.assertIn("frieren", enriched)
        self.assertIn("white hair", enriched)
        self.assertIn("<lora:SousouNoFrieren_Frieren_IlluXL:0.85>", enriched)
        print(f"[PASS] LoRA Trigger Injected: '{enriched}'")

    def test_04_generate_and_status(self):
        """Test POST /ai/generate endpoint queue submission and GET /ai/task status"""
        task_id = "test-task-frieren-001"
        payload = {
            "task_id": task_id,
            "prompt": "a magical girl casting spell in a forest",
            "model": "counterfeitV30_v30.safetensors",
            "lora": "SousouNoFrieren_Frieren_IlluXL.safetensors",
            "steps": 20
        }
        headers = {"X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET}
        response = self.client.post("/ai/generate", json=payload, headers=headers)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data["status"], "accepted")
        self.assertEqual(data["task_id"], task_id)

        # Check in-memory task status
        status_resp = self.client.get(f"/ai/task/{task_id}")
        self.assertEqual(status_resp.status_code, 200)
        print(f"[PASS] Generate & State: Task ID = {task_id}, State = {status_resp.json()['status']}")

    def test_05_task_cancellation(self):
        """Test DELETE /ai/task/:id Soft Cancel logic"""
        task_id = "test-task-cancel-001"
        payload = {
            "task_id": task_id,
            "prompt": "a landscape to be cancelled",
            "steps": 50
        }
        headers = {"X-LUMA-INTERNAL-SECRET": AIConfig.INTERNAL_SECRET}
        self.client.post("/ai/generate", json=payload, headers=headers)

        # Cancel the task
        del_resp = self.client.delete(f"/ai/task/{task_id}", headers=headers)
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(del_resp.json()["status"], "cancelled")
        print(f"[PASS] Task Cancellation: Successfully cancelled {task_id}")

if __name__ == "__main__":
    unittest.main()
