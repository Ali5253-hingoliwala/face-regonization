"""Local VisionAttend AI attendance worker.

This worker is intended to run on the computer that has the webcam/CCTV
connected. The public FastAPI service can live on Render, while this process
polls MongoDB Atlas for an active attendance session and starts the existing
SVM multi-face pipeline locally.

Run from the project root:
    python ml/pipeline/attendance_worker.py

The worker does not expose an HTTP server and never contains cloud/API
secrets in source code. MongoDB configuration is loaded through the existing
project .env handling.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
PIPELINE_SCRIPT = CURRENT_DIR / "attendance_pipeline_svm.py"
POLL_SECONDS = 2.0

# Make the existing attendance/session modules importable without changing
# their implementation.
ATTENDANCE_DIR = PROJECT_ROOT / "ml" / "attendance"
UTILS_DIR = PROJECT_ROOT / "ml" / "utils"
sys.path.append(str(ATTENDANCE_DIR))
sys.path.append(str(UTILS_DIR))

from session_manager import SessionManager


def start_pipeline() -> subprocess.Popen:
    print("[WORKER] Starting local SVM attendance pipeline...")
    # Render stores session timestamps in UTC. The local machine may be in
    # another timezone (for example IST), so explicitly tell the child
    # pipeline to use the same UTC session clock when launched by this worker.
    env = os.environ.copy()
    env["VISIONATTEND_SESSION_CLOCK"] = "utc"
    return subprocess.Popen(
        [sys.executable, str(PIPELINE_SCRIPT)],
        cwd=str(PROJECT_ROOT),
        env=env,
    )


def stop_pipeline(process: subprocess.Popen) -> None:
    if process.poll() is None:
        print("[WORKER] Active session ended. Stopping local SVM pipeline...")
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            print("[WORKER] Pipeline did not stop gracefully; terminating it.")
            process.kill()
            process.wait(timeout=3)


def main() -> None:
    session_manager = SessionManager()
    pipeline_process: subprocess.Popen | None = None
    active_session_id: str | None = None

    print("=" * 64)
    print("VISIONATTEND AI - LOCAL ATTENDANCE WORKER")
    print("=" * 64)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Polling MongoDB every {POLL_SECONDS:g} seconds")
    print("Waiting for an active attendance session...\n")

    try:
        while True:
            session = session_manager.get_current_session()

            if session is not None:
                session_id = session["session_id"]

                if pipeline_process is None or pipeline_process.poll() is not None:
                    pipeline_process = start_pipeline()
                    active_session_id = session_id
                    print(
                        f"[WORKER] Monitoring session {session_id} "
                        f"({session['name']})."
                    )

            else:
                if pipeline_process is not None and pipeline_process.poll() is None:
                    stop_pipeline(pipeline_process)
                pipeline_process = None
                active_session_id = None

            if (
                session is not None
                and pipeline_process is not None
                and pipeline_process.poll() is not None
            ):
                print(
                    f"[WORKER] Pipeline exited with code "
                    f"{pipeline_process.returncode}. It will restart."
                )
                pipeline_process = None

            time.sleep(POLL_SECONDS)

    except KeyboardInterrupt:
        print("\n[WORKER] Shutdown requested.")
    finally:
        if pipeline_process is not None and pipeline_process.poll() is None:
            stop_pipeline(pipeline_process)
        print("[WORKER] Local attendance worker stopped.")


if __name__ == "__main__":
    main()
