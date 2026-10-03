"""
=============================================================================
LUMA Distributed AI Inference Node — FIFO Queue & Concurrency Manager
=============================================================================
ไฟล์นี้เป็น "หัวใจสำคัญ" ในการบริหารจัดการคิวงาน (Concurrency Control):
1. ควบคุมการเข้าถึง GPU ด้วยคิวลำดับก่อน-หลัง (First-In, First-Out: FIFO Queue)
   เนื่องจากการ์ดจอ NVIDIA RTX 3070 มี VRAM 8GB ซึ่งจำกัดการรันได้ทีละ 1 งาน
2. ป้องกัน Bottleneck: ตอบกลับ Backend ทันทีด้วย HTTP 202 Accepted (Non-blocking)
3. ระบบติดตามสถานะคิว (Telemetry): คำนวณตำแหน่งคิว (queue_position) และดึง Live Progress จาก Forge
4. การยกเลิกงาน 2 รูปแบบ (Dual-Mode Cancellation):
   - Soft Cancel: ยกเลิกงานที่ยังรออยู่ในคิว ไม่ให้เข้าสู่ GPU
   - Hard Cancel: สั่ง Interrupt หยุดการคำนวณของ GPU ทันทีหากงานกำลังรันอยู่
5. Watchdog Timeout & VRAM Auto-Purge: ตัดงานที่ค้างเกินเวลา และเคลียร์ขยะ VRAM เสมอ
=============================================================================
"""

import asyncio
import time
from typing import Callable, Any, Dict, Optional
from ai_server.config import AIConfig
from ai_server.utils.callbacks import send_callback_with_retry
from ai_server.utils.gpu_monitor import clear_vram_cache
from ai_server.services.forge_client import interrupt_forge_generation, get_forge_progress


class AITaskQueue:
    """
    คลาสจัดการคิวงานการสร้างภาพแบบไม่บล็อกการทำงาน (Non-blocking Asynchronous FIFO Queue)
    """

    def __init__(self):
        self._loop = None
        self._queue = None
        self._worker_task = None
        self.is_busy = False                             # สถานะว่า GPU กำลังประมวลผลงานอยู่หรือไม่
        self.current_task_id: Optional[str] = None       # Task ID ของงานที่กำลังรันบน GPU
        self._current_task_future: Optional[asyncio.Future] = None  # Future สำหรับควบคุมการ Cancel งาน
        self._task_states: Dict[str, dict] = {}          # ตารางเก็บ State ของแต่ละงานในหน่วยความจำ

    def _ensure_queue(self):
        """
        ตรวจสอบและผูก asyncio.Queue เข้ากับ Event Loop ปัจจุบัน
        ป้องกันปัญหาข้าม Event Loop เมื่อรันภายใต้ ASGI Server (Uvicorn) หรือ Test Suite
        """
        try:
            curr_loop = asyncio.get_running_loop()
        except RuntimeError:
            curr_loop = None

        if self._queue is None or self._loop != curr_loop:
            self._loop = curr_loop
            self._queue = asyncio.Queue()
            self._worker_task = None

    def start_worker(self):
        """สตาร์ต Background Worker Task เพื่อคอยหยิบงานจากคิวไปรัน"""
        self._ensure_queue()
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._process_queue())
            print("[QUEUE] Background Task Queue worker started.")

    def stop_worker(self):
        """หยุดการทำงานของ Background Worker"""
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            self._worker_task = None
            print("[QUEUE] Background Task Queue worker stopped.")

    async def enqueue(self, task_data: dict, handler: Callable[[dict], Any]) -> int:
        """
        นำงานเข้าสู่คิว FIFO:
        
        Parameters:
            task_data (dict): ข้อมูลพารามิเตอร์ของงานสร้างภาพ
            handler (Callable): ฟังก์ชันที่จะใช้ประมวลผล (เช่น handle_txt2img_inference)
            
        Returns:
            int: จำนวนงานทั้งหมดที่รออยู่ในคิวขณะนี้
        """
        self._ensure_queue()
        self.start_worker()
        
        task_id = task_data.get("task_id", f"task-{int(time.time()*1000)}")
        task_data["task_id"] = task_id
        
        # บันทึกสถานะเริ่มต้นของงานลงใน State Cache
        self._task_states[task_id] = {
            "status": "queued",
            "enqueued_at": time.time(),
            "data": task_data
        }

        # ใส่ Tuple (ข้อมูลงาน, ตัวจัดการ) ลงใน asyncio.Queue
        await self._queue.put((task_data, handler))
        return self._queue.qsize()

    def get_task_status(self, task_id: str) -> Optional[dict]:
        """
        ดึงสถานะและความคืบหน้าของงานแบบ Real-time:
        - หากอยู่ในสถานะ 'queued': คำนวณลำดับคิวปัจจุบัน (1-indexed)
        - หากอยู่ในสถานะ 'processing': ดึงค่า Step และ Progress จาก Forge API
        - หากอยู่ในสถานะ 'completed': คืนค่า Progress 100% พร้อม Seed จริง
        """
        state_info = self._task_states.get(task_id)
        if not state_info:
            return None

        status = state_info.get("status")
        result = dict(state_info)
        result["total_queued"] = self._queue.qsize() if self._queue else 0

        # กรณีงานกำลังรอในคิว: คำนวณว่าอยู่อันดับที่เท่าไหร่
        if status == "queued" and self._queue:
            pos = 1
            for t_data, _ in list(self._queue._queue):
                if t_data.get("task_id") == task_id:
                    result["queue_position"] = pos
                    break
                pos += 1
            if "queue_position" not in result:
                result["queue_position"] = 1
                
        # กรณีงานกำลังรันบน GPU: ดึงเปอร์เซ็นต์ Denoising จาก Forge GPU
        elif status == "processing":
            result["queue_position"] = 0
            if "started_at" in state_info:
                result["elapsed"] = round(time.time() - state_info["started_at"], 2)
            
            # โพลล์สถิติ Step ล่าสุดจาก GPU
            forge_prog = get_forge_progress()
            result["progress"] = forge_prog.get("progress", 0.0)
            result["step"] = forge_prog.get("step", 0)
            result["total_steps"] = forge_prog.get("total_steps", 0)
            
        elif status == "completed":
            result["queue_position"] = 0
            result["progress"] = 1.0

        return result

    async def cancel_task(self, task_id: str) -> tuple[int, str]:
        """
        ระบบยกเลิกงาน 2 รูปแบบ (Dual-Mode Cancellation):
        
        1. Soft Cancel (งานยังอยู่ในคิว):
           เปลี่ยนสถานะเป็น 'cancelled' เมื่อ Worker มาหยิบงานนี้จะข้ามไปทันทีโดยไม่เปลืองแรง GPU
        2. Hard Cancel (งานกำลังรันอยู่บน GPU):
           ส่งคำสั่ง HTTP ไปยัง /sdapi/v1/interrupt ของ Forge เพื่อสั่ง GPU หยุดคำนวณทันที
        """
        state_info = self._task_states.get(task_id)
        if not state_info:
            return 404, "Task not found"

        status = state_info.get("status")

        if status == "completed":
            return 409, "Cannot cancel: Task is already completed"

        if status == "cancelled":
            return 200, "Task was already cancelled"

        # ---------------------------------------------------------------------
        # 1. Soft Cancel: งานกำลังรออยู่ในคิว
        # ---------------------------------------------------------------------
        if status == "queued":
            state_info["status"] = "cancelled"
            print(f"[QUEUE SOFT CANCEL] Task {task_id} marked as cancelled in queue.")
            
            # ส่ง Webhook แจ้ง Backend ให้ทราบว่างานถูกยกเลิกแล้ว
            asyncio.create_task(send_callback_with_retry(
                task_id=task_id,
                status="cancelled",
                error_message="Task cancelled by user before processing",
                callback_url=state_info.get("data", {}).get("callback_url", AIConfig.BACKEND_CALLBACK_URL)
            ))
            return 200, "Task removed from queue (Soft Cancel)"

        # ---------------------------------------------------------------------
        # 2. Hard Cancel: งานกำลังประมวลผลอยู่บนการ์ดจอ RTX 3070
        # ---------------------------------------------------------------------
        if status == "processing" and self.current_task_id == task_id:
            state_info["status"] = "cancelled"
            print(f"[QUEUE HARD CANCEL] Interrupting active GPU task: {task_id}")
            
            # ยิงสัญญาณ Interrupt ไปที่ Forge API โดยตรง
            await asyncio.to_thread(interrupt_forge_generation)

            # ยกเลิก Async Future บน Python Worker
            if self._current_task_future and not self._current_task_future.done():
                self._current_task_future.cancel()

            # ส่ง Webhook แจ้ง Backend
            asyncio.create_task(send_callback_with_retry(
                task_id=task_id,
                status="cancelled",
                error_message="Task interrupted during GPU processing",
                callback_url=state_info.get("data", {}).get("callback_url", AIConfig.BACKEND_CALLBACK_URL)
            ))
            return 200, "GPU execution interrupted (Hard Cancel)"

        return 400, f"Cannot cancel task in state '{status}'"

    async def _process_queue(self):
        """
        Background Worker Loop:
        ทำงานวนลูปเพื่อดึงงานจากคิว FIFO ไปประมวลผลทีละงานตามลำดับ
        """
        while True:
            try:
                task_data, handler = await self._queue.get()
                task_id = task_data.get("task_id", "unknown")
                callback_url = task_data.get("callback_url", AIConfig.BACKEND_CALLBACK_URL)

                # หากงานนี้ถูกยกเลิก (Soft Cancel) ระหว่างรอคิว ให้ข้ามไปทันที
                state_info = self._task_states.get(task_id, {})
                if state_info.get("status") == "cancelled":
                    print(f"[QUEUE SKIP] Skipping cancelled task: {task_id}")
                    self._queue.task_done()
                    continue

                # อัปเดตสถานะว่าเริ่มประมวลผลบน GPU
                self.is_busy = True
                self.current_task_id = task_id
                state_info["status"] = "processing"
                state_info["started_at"] = time.time()
                start_time = time.time()
                print(f"\n[QUEUE] >>> Processing task: {task_id}")

                try:
                    # รันฟังก์ชัน Inference ใน Thread แยกเพื่อไม่ให้บล็อก Async Event Loop
                    task_coro = asyncio.to_thread(handler, task_data)
                    self._current_task_future = asyncio.ensure_future(task_coro)

                    # Watchdog Timeout: คอยคุมไม่ให้งานรันเกิน TASK_TIMEOUT_SECONDS (120 วิ)
                    result = await asyncio.wait_for(
                        self._current_task_future,
                        timeout=AIConfig.TASK_TIMEOUT_SECONDS
                    )
                    
                    if isinstance(result, tuple):
                        result_b64, actual_seed = result
                    else:
                        result_b64 = result
                        actual_seed = task_data.get("seed")

                    elapsed = time.time() - start_time
                    state_info["status"] = "completed"
                    state_info["elapsed"] = elapsed
                    state_info["seed"] = actual_seed
                    print(f"[QUEUE] <<< Task {task_id} completed in {elapsed:.2f}s (seed={actual_seed})")

                    # ส่งผลลัพธ์ผ่าน Webhook กลับไปยัง Backend
                    await send_callback_with_retry(
                        task_id=task_id,
                        status="completed",
                        image_base64=result_b64,
                        generation_time=elapsed,
                        seed=actual_seed,
                        callback_url=callback_url
                    )

                except asyncio.CancelledError:
                    print(f"[QUEUE CANCELLED] Task {task_id} was cancelled.")
                    state_info["status"] = "cancelled"

                except asyncio.TimeoutError:
                    print(f"[QUEUE TIMEOUT] Task {task_id} exceeded {AIConfig.TASK_TIMEOUT_SECONDS}s.")
                    state_info["status"] = "failed"
                    # ส่งสัญญาณขัดจังหวะฉุกเฉินไปยัง GPU ทันที เพื่อหยุดงานที่ค้าง ไม่ให้ชนกับงานถัดไป
                    await asyncio.to_thread(interrupt_forge_generation)
                    await send_callback_with_retry(
                        task_id=task_id,
                        status="failed",
                        error_message="Task execution timeout on AI Server",
                        callback_url=callback_url
                    )

                except Exception as err:
                    print(f"[QUEUE ERROR] Task {task_id} failed: {err}")
                    state_info["status"] = "failed"
                    await send_callback_with_retry(
                        task_id=task_id,
                        status="failed",
                        error_message=str(err),
                        callback_url=callback_url
                    )

                finally:
                    # เคลียร์หน่วยความจำ VRAM บน GPU เสมอหลังจบงาน (ไม่ว่าจะสำเร็จหรือล้มเหลว)
                    clear_vram_cache()
                    self.is_busy = False
                    self.current_task_id = None
                    self._current_task_future = None
                    self._queue.task_done()

            except asyncio.CancelledError:
                print("[QUEUE WORKER] Worker cancelled, exiting loop.")
                break
            except Exception as loop_err:
                print(f"[QUEUE WORKER FATAL] Loop error: {loop_err}")
                await asyncio.sleep(1)


# สร้าง Global Instance ของ Task Queue สำหรับใช้งานร่วมกันทั่วทั้งแอปพลิเคชัน
task_queue = AITaskQueue()
