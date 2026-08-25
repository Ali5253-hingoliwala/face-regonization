import json
import os
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


class SecurityMiddleware(BaseHTTPMiddleware):
    """Defensive API middleware: configurable rate limits and security headers.

    Limits are process-local. For a multi-worker production deployment, move the
    counters to Redis so all workers share the same limits.
    """

    def __init__(self, app):
        super().__init__(app)
        self.auth_ip_limit = _int_env("AUTH_IP_LIMIT", 10)
        self.auth_account_limit = _int_env("AUTH_ACCOUNT_LIMIT", 5)
        self.auth_window = _int_env("AUTH_WINDOW_SECONDS", 300)
        self.public_limit = _int_env("PUBLIC_LIMIT", 60)
        self.public_window = _int_env("PUBLIC_WINDOW_SECONDS", 60)
        self.authenticated_limit = _int_env("AUTHENTICATED_LIMIT", 120)
        self.authenticated_window = _int_env("AUTHENTICATED_WINDOW_SECONDS", 60)
        self.backoff_base = _int_env("AUTH_BACKOFF_BASE_SECONDS", 1)
        self.backoff_max = _int_env("AUTH_BACKOFF_MAX_SECONDS", 60)
        self.max_body = _int_env("MAX_REQUEST_BODY_BYTES", 8_000_000)
        self.ip_hits = defaultdict(deque)
        self.account_hits = defaultdict(deque)
        self.failures = defaultdict(int)
        self.failure_until = defaultdict(float)

    @staticmethod
    def _ip(request):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    @staticmethod
    def _prune(bucket, window, now):
        while bucket and now - bucket[0] >= window:
            bucket.popleft()

    def _allow(self, store, key, limit, window):
        now = time.monotonic()
        bucket = store[key]
        self._prune(bucket, window, now)
        if len(bucket) >= limit:
            retry = max(1, int(window - (now - bucket[0])))
            return False, retry
        bucket.append(now)
        return True, 0

    async def dispatch(self, request, call_next):
        path = request.url.path
        ip = self._ip(request)
        is_auth_route = path in {"/auth/login", "/auth/signup"} or path == "/profile/password"
        is_public = path == "/health"

        account = None
        if is_auth_route and request.method in {"POST", "PUT"}:
            body = await request.body()
            if len(body) > self.max_body:
                return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
            if path in {"/auth/login", "/auth/signup"}:
                try:
                    data = json.loads(body or b"{}")
                    account = str(data.get("username") or data.get("student_id") or "").strip().lower() or None
                except (ValueError, TypeError):
                    account = None

        if is_auth_route:
            ok, retry = self._allow(self.ip_hits, f"auth-ip:{ip}", self.auth_ip_limit, self.auth_window)
            if not ok:
                return self._limited(retry, "Too many authentication requests from this IP.")
            if account:
                ok, retry = self._allow(self.account_hits, f"auth-account:{account}", self.auth_account_limit, self.auth_window)
                if not ok:
                    return self._limited(retry, "Too many attempts for this account. Try again later.")
                remaining_backoff = self.failure_until.get(account, 0) - time.monotonic()
                if remaining_backoff > 0:
                    return self._limited(max(1, int(remaining_backoff)), "Too many failed attempts. Please wait before trying again.")
        elif is_public:
            ok, retry = self._allow(self.ip_hits, f"public:{ip}", self.public_limit, self.public_window)
            if not ok:
                return self._limited(retry, "Too many requests.")
        else:
            ok, retry = self._allow(self.ip_hits, f"api:{ip}", self.authenticated_limit, self.authenticated_window)
            if not ok:
                return self._limited(retry, "Too many requests.")

        response = await call_next(request)

        if is_auth_route and account:
            if response.status_code in {401, 403}:
                failures = self.failures[account] + 1
                self.failures[account] = min(failures, 10)
                delay = min(self.backoff_max, self.backoff_base * (2 ** max(0, failures - 1)))
                self.failure_until[account] = time.monotonic() + delay
            elif response.status_code < 400:
                self.failures.pop(account, None)
                self.failure_until.pop(account, None)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=()"
        response.headers["Cache-Control"] = "no-store" if path.startswith(("/auth/", "/profile", "/me/")) else "no-cache"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; base-uri 'self'; object-src 'none'; "
            "frame-ancestors 'none'; img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'"
        )
        return response

    @staticmethod
    def _limited(retry, message):
        response = JSONResponse(status_code=429, content={"detail": message})
        response.headers["Retry-After"] = str(retry)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
