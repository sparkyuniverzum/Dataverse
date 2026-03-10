from __future__ import annotations

import asyncio
from types import SimpleNamespace

from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.middleware.shutdown_gate import create_shutdown_gate_middleware


def _request(*, accepting_requests: bool) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/any",
        "raw_path": b"/any",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "app": SimpleNamespace(state=SimpleNamespace(accepting_requests=accepting_requests)),
    }

    async def receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def test_shutdown_gate_allows_requests_when_runtime_accepts_traffic() -> None:
    middleware = create_shutdown_gate_middleware()

    async def call_next(_request: Request):
        return JSONResponse(status_code=200, content={"ok": True})

    response = asyncio.run(middleware(_request(accepting_requests=True), call_next))

    assert response.status_code == 200


def test_shutdown_gate_rejects_requests_with_stable_503_envelope() -> None:
    middleware = create_shutdown_gate_middleware()

    async def call_next(_request: Request):
        return JSONResponse(status_code=200, content={"ok": True})

    response = asyncio.run(middleware(_request(accepting_requests=False), call_next))

    assert response.status_code == 503
    assert b"SERVICE_SHUTTING_DOWN" in response.body
    assert b"http.shutdown_gate" in response.body
