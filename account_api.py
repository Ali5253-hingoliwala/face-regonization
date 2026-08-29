"""Compatibility shim for backend.main's account_api import."""
from backend.account_api import router

__all__ = ["router"]
