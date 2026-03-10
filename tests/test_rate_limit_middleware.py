from __future__ import annotations

import asyncio

from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.middleware.resilience import RateLimitConfig, create_rate_limit_middleware


def _request(*, path: str, forwarded_for: str | None = None) -> Request:
    headers = []
    if forwarded_for:
        headers.append((b"x-forwarded-for", forwarded_for.encode("utf-8")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }

    async def receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def test_rate_limit_returns_429_with_stable_envelope() -> None:
    middleware = create_rate_limit_middleware(RateLimitConfig(enabled=True, max_requests=2, window_seconds=60))

    async def call_next(_request: Request):
        return JSONResponse(status_code=200, content={"ok": True})

    first = asyncio.run(middleware(_request(path="/health"), call_next))
    second = asyncio.run(middleware(_request(path="/health"), call_next))
    blocked = asyncio.run(middleware(_request(path="/health"), call_next))

    assert first.status_code == 200
    assert second.status_code == 200
    assert blocked.status_code == 429
    assert blocked.headers.get("Retry-After") is not None
    assert b"RATE_LIMIT_EXCEEDED" in blocked.body


def test_rate_limit_is_path_scoped_for_same_client() -> None:
    middleware = create_rate_limit_middleware(RateLimitConfig(enabled=True, max_requests=1, window_seconds=60))

    async def call_next(_request: Request):
        return JSONResponse(status_code=200, content={"ok": True})

    assert asyncio.run(middleware(_request(path="/a"), call_next)).status_code == 200
    assert asyncio.run(middleware(_request(path="/a"), call_next)).status_code == 429
    assert asyncio.run(middleware(_request(path="/b"), call_next)).status_code == 200
