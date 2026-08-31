# ai_server/services/queue_manager.py
import asyncio
import time
from typing import Callable, Any, Dict, Optional
from ai_server.config import AIConfig
from ai_server.utils.callbacks import send_callback_with_retry
from ai_server.utils.gpu_monitor import clear_vram_cache
from ai_server.services.forge_client import interrupt_forge_generation

class AITaskQueue:
    """
    In-memory FIFO Task Queue with State Tracking and Soft/Hard Cancellation.
    """
    def __init__(self):
        self._loop = None
        self._queue = None
        self._worker_task = None
        self.is_busy = False
        self.current_task_id: Optional[str] = None
        self._current_task_future: Optional[asyncio.Future] = None
        self._task_states: Dict[str, dict] = {}

    def _ensure_queue(self):
        try:
            curr_loop = asyncio.get_running_loop()
        except RuntimeError:
            curr_loop = None

        if self._queue is None or self._loop != curr_loop:
            self._loop = curr_loop
            self._queue = asyncio.Queue()
            self._worker_task = None

    def start_worker(self):
        self._ensure_queue()
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._process_queue())
            print("[QUEUE] Background Task Queue worker started.")

    def stop_worker(self):
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            self._worker_task = None
            print("[QUEUE] Background Task Queue worker stopped.")

    async def enqueue(self, task_data: dict, handler: Callable[[dict], Any]) -> int:
        """Adds a new generation task to the FIFO queue."""
        self._ensure_queue()
        self.start_worker()
        task_id = task_data.get("task_id", f"task-{int(time.time()*1000)}")
        task_data["task_id"] = task_id
        
        self._task_states[task_id] = {
            "status": "queued",
            "enqueued_at": time.time(),
            "data": task_data
        }

        await self._queue.put((task_data, handler))
        return self._queue.qsize()

    def get_task_status(self, task_id: str) -> Optional[dict]:
        return self._task_states.get(task_id)

    async def cancel_task(self, task_id: str) -> tuple[int, str]:
        """
        Implements Soft and Hard cancellation as recommended by Iris:
        - Soft Cancel: Task in QUEUED state is removed before GPU runs.
        - Hard Cancel: Task in PROCESSING state is interrupted immediately.
        """
        state_info = self._task_states.get(task_id)
        if not state_info:
            return 404, "Task not found"

        status = state_info.get("status")

        if status == "completed":
            return 409, "Cannot cancel: Task is already completed"

        if status == "cancelled":
            return 200, "Task was already cancelled"

        # 1. Soft Cancel (Task is still in Queue)
        if status == "queued":
            state_info["status"] = "cancelled"
            print(f"[QUEUE SOFT CANCEL] Task {task_id} marked as cancelled in queue.")
            # Dispatch callback to notify backend
            asyncio.create_task(send_callback_with_retry(
                task_id=task_id,
                status="cancelled",
                error_message="Task cancelled by user before processing",
                callback_url=state_info.get("data", {}).get("callback_url", AIConfig.BACKEND_CALLBACK_URL)
            ))
            return 200, "Task removed from queue (Soft Cancel)"

        # 2. Hard Cancel (Task is currently being processed on GPU)
        if status == "processing" and self.current_task_id == task_id:
            state_info["status"] = "cancelled"
            print(f"[QUEUE HARD CANCEL] Interrupting active GPU task: {task_id}")
            
            # Send interrupt signal to Forge API
            await asyncio.to_thread(interrupt_forge_generation)

            # Cancel current async future if running
            if self._current_task_future and not self._current_task_future.done():
                self._current_task_future.cancel()

            # Dispatch callback to notify backend
            asyncio.create_task(send_callback_with_retry(
                task_id=task_id,
                status="cancelled",
                error_message="Task interrupted during GPU processing",
                callback_url=state_info.get("data", {}).get("callback_url", AIConfig.BACKEND_CALLBACK_URL)
            ))
            return 200, "GPU execution interrupted (Hard Cancel)"

        return 400, f"Cannot cancel task in state '{status}'"

    async def _process_queue(self):
        while True:
            try:
                task_data, handler = await self._queue.get()
                task_id = task_data.get("task_id", "unknown")
                callback_url = task_data.get("callback_url", AIConfig.BACKEND_CALLBACK_URL)

                # If task was cancelled while sitting in queue, skip it!
                state_info = self._task_states.get(task_id, {})
                if state_info.get("status") == "cancelled":
                    print(f"[QUEUE SKIP] Skipping cancelled task: {task_id}")
                    self._queue.task_done()
                    continue

                self.is_busy = True
                self.current_task_id = task_id
                state_info["status"] = "processing"
                state_info["started_at"] = time.time()
                start_time = time.time()
                print(f"\n[QUEUE] >>> Processing task: {task_id}")

                try:
                    # Run inference in worker thread with timeout watchdog
                    task_coro = asyncio.to_thread(handler, task_data)
                    self._current_task_future = asyncio.ensure_future(task_coro)

                    result_b64 = await asyncio.wait_for(
                        self._current_task_future,
                        timeout=AIConfig.TASK_TIMEOUT_SECONDS
                    )
                    
                    elapsed = time.time() - start_time
                    state_info["status"] = "completed"
                    state_info["elapsed"] = elapsed
                    print(f"[QUEUE] <<< Task {task_id} completed in {elapsed:.2f}s")

                    # Dispatch result callback
                    await send_callback_with_retry(
                        task_id=task_id,
                        status="completed",
                        image_base64=result_b64,
                        generation_time=elapsed,
                        callback_url=callback_url
                    )

                except asyncio.CancelledError:
                    print(f"[QUEUE CANCELLED] Task {task_id} was cancelled.")
                    state_info["status"] = "cancelled"

                except asyncio.TimeoutError:
                    print(f"[QUEUE TIMEOUT] Task {task_id} exceeded {AIConfig.TASK_TIMEOUT_SECONDS}s.")
                    state_info["status"] = "failed"
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

# Global Task Queue Instance
task_queue = AITaskQueue()
