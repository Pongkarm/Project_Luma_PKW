"""
=============================================================================
LUMA Platform — Master Python Test Suite Runner
=============================================================================
สคริปต์กลางภาษา Python สำหรับค้นหาและสั่งรันชุดทดสอบทุกสายงานในครั้งเดียว:
1. Track 01: DevOps & Nginx Gateway
2. Track 02: Web Frontend Studio
3. Track 03: Backend Core API & Database
4. Track 04: AI Inference Node
5. Track 05: Multi-Node E2E Full Pipeline
=============================================================================
"""

import unittest
import os
import sys
import time

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TEST_CASES_DIR = os.path.dirname(os.path.abspath(__file__))

TRACK_FOLDERS = [
    ("01_DevOps_Gateway", "Node 1: DevOps & Nginx Gateway"),
    ("02_Frontend_Web", "Node 2: Web Frontend Studio"),
    ("03_Backend_API", "Node 3: Backend Core API & Database"),
    ("04_AI_Inference_Node", "Node 4: AI Inference Engine & GPU"),
    ("05_End_to_End_Integration", "Multi-Node: Full Pipeline E2E")
]

def run_all_suites():
    print("=" * 80)
    print("      [LUMA DISTRIBUTED PLATFORM] - MASTER QUALITY ASSURANCE SUITE")
    print("=" * 80)
    print(f"  Execution Path : {TEST_CASES_DIR}")
    print(f"  Python Runtime : Python {sys.version.split()[0]} ({sys.platform})")
    print(f"  Execution Time : {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()

    loader = unittest.TestLoader()
    master_suite = unittest.TestSuite()

    for folder, title in TRACK_FOLDERS:
        track_dir = os.path.join(TEST_CASES_DIR, folder)
        if os.path.isdir(track_dir):
            discovered = loader.discover(start_dir=track_dir, pattern="test_*.py", top_level_dir=track_dir)
            count = discovered.countTestCases()
            print(f"  [DISCOVER] {title:<42} : Found {count} Tests")
            master_suite.addTests(discovered)

    print()
    print("-" * 80)
    print("  STARTING TEST EXECUTION")
    print("-" * 80)
    print()

    runner = unittest.TextTestRunner(verbosity=2)
    start_time = time.time()
    result = runner.run(master_suite)
    duration = time.time() - start_time

    total = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    passed = total - failures - errors
    pass_rate = round((passed / total * 100), 1) if total > 0 else 0

    print()
    print("=" * 80)
    print("                           MASTER QA SUMMARY REPORT")
    print("=" * 80)
    print(f"  Total Test Cases Executed : {total}")
    print(f"  Passed Test Cases         : {passed}  [PASS]")
    print(f"  Failed Test Cases         : {failures}  [FAIL]")
    print(f"  Errored Test Cases        : {errors}  [ERROR]")
    print(f"  Overall Pass Rate         : {pass_rate}%")
    print(f"  Execution Duration        : {duration:.3f} seconds")
    print("=" * 80)

    if failures == 0 and errors == 0 and total > 0:
        print("\n  [CONGRATULATIONS] All Test Cases across ALL Tracks PASSED 100%!")
        print("  The LUMA Distributed AI Platform is verified and production-ready.\n")
        return 0
    else:
        print("\n  [WARNING] Some tests failed. Please review the tracebacks above.\n")
        return 1

if __name__ == "__main__":
    exit_code = run_all_suites()
    sys.exit(exit_code)
