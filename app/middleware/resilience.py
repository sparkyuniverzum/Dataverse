from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.api.error_envelopes import resilience_error_detail


@dataclass(frozen=True)
class RateLimitConfig:
    enabled: bool = True
    max_requests: int = 300
    window_seconds: int = 60


class InMemoryRateLimiter:
    def __init__(self, *, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max(1, int(max_requests))
        self.window_seconds = max(1, int(window_seconds))
        self._buckets: dict[str, deque[float]] = {}

    def check(self, *, key: str, now_ts: float) -> tuple[bool, int]:
        cutoff = now_ts - float(self.window_seconds)
        bucket = self._buckets.setdefault(key, deque())
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            retry_after = max(1, int((bucket[0] + float(self.window_seconds)) - now_ts))
            return False, retry_after
        bucket.append(now_ts)
        return True, 0


def _request_key(request: Request) -> str:
    forwarded_for = str(request.headers.get("x-forwarded-for") or "").strip()
    client_key = forwarded_for.split(",")[0].strip() if forwarded_for else ""
    if not client_key and request.client is not None:
        client_key = str(request.client.host or "").strip()
    if not client_key:
        client_key = "unknown"
    return f"{client_key}:{request.url.path}"


def create_rate_limit_middleware(config: RateLimitConfig):
    limiter = InMemoryRateLimiter(
        max_requests=config.max_requests,
        window_seconds=config.window_seconds,
    )

    async def _middleware(request: Request, call_next):
        if not config.enabled:
            return await call_next(request)

        now = datetime.now(UTC).timestamp()
        key = _request_key(request)
        allowed, retry_after = limiter.check(key=key, now_ts=now)
        if not allowed:
            detail = resilience_error_detail(
                code="RATE_LIMIT_EXCEEDED",
                message="Too many requests.",
                service="http.rate_limiter",
                retry_after_seconds=retry_after,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": detail},
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)

    return _middleware
