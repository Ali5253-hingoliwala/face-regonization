"""Render entrypoint for the cloud-only FastAPI service.

The public API stores session state in MongoDB Atlas. Camera/ML inference is
performed by the local attendance_worker.py process, not by Render.

The existing backend.main module remains the local-development entrypoint.
This adapter only replaces the subprocess lifecycle used by the API when the
same application is hosted on Render.
"""

from __future__ import annotations

import backend.main as main_module


class _CloudPipelineState:
    """Small process-compatible state object for the existing API routes."""

    def __init__(self):
        self.active = False

    @property
    def pid(self):
        return None

    def poll(self):
        return None if self.active else 0

    def terminate(self):
        self.active = False


cloud_pipeline = _CloudPipelineState()


def _launch_cloud_pipeline_if_not_running():
    """Mark the cloud-side pipeline state active without opening a camera."""
    if not cloud_pipeline.active:
        cloud_pipeline.active = True
        main_module.pipeline_process = cloud_pipeline
        return True
    main_module.pipeline_process = cloud_pipeline
    return False


def _close_cloud_session_and_pipeline(session=None):
    """Close MongoDB session state; the local worker owns the camera process."""
    if session is None:
        session = main_module.session_manager.get_current_session()
    if session is not None:
        main_module._mark_session_absentees(session)
        main_module.session_manager.end_session(session["session_id"])
    cloud_pipeline.active = False
    main_module.pipeline_process = None


def _synchronize_cloud_pipeline():
    """Never interpret the absent local camera process as a crashed session."""
    if main_module.session_manager.get_current_session() is None:
        cloud_pipeline.active = False
        main_module.pipeline_process = None


# Patch only the process lifecycle hooks used by backend.main's existing routes.
main_module._launch_pipeline_if_not_running = _launch_cloud_pipeline_if_not_running
main_module._close_session_and_pipeline = _close_cloud_session_and_pipeline
main_module._synchronize_dead_pipeline = _synchronize_cloud_pipeline

app = main_module.app
