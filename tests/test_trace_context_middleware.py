from __future__ import annotations

import asyncio

from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.middleware.trace_context import create_trace_context_middleware
from app.services.logging_helpers import structured_log_extra


def _request(*, headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/health",
        "raw_path": b"/health",
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }

    async def receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def test_trace_context_middleware_propagates_ids_to_response_and_logging_context() -> None:
    middleware = create_trace_context_middleware()
    trace_header = b"trace-fixed"
    correlation_header = b"corr-fixed"
    request = _request(
        headers=[
            (b"x-trace-id", trace_header),
            (b"x-correlation-id", correlation_header),
        ]
    )

    async def call_next(_request: Request):
        payload = structured_log_extra(event_name="test.event", module="test.module")
        return JSONResponse(status_code=200, content=payload)

    response = asyncio.run(middleware(request, call_next))
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == trace_header.decode("utf-8")
    assert response.headers.get("X-Correlation-Id") == correlation_header.decode("utf-8")
    assert "trace-fixed" in body
    assert "corr-fixed" in body


def test_trace_context_middleware_uses_traceparent_when_custom_header_missing() -> None:
    middleware = create_trace_context_middleware()
    traceparent = b"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    request = _request(headers=[(b"traceparent", traceparent)])

    async def call_next(_request: Request):
        payload = structured_log_extra(event_name="test.event", module="test.module")
        return JSONResponse(status_code=200, content=payload)

    response = asyncio.run(middleware(request, call_next))
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == "4bf92f3577b34da6a3ce929d0e0e4736"
    assert "4bf92f3577b34da6a3ce929d0e0e4736" in body
