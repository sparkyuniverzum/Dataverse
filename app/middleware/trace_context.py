from __future__ import annotations

from starlette.requests import Request

from app.services.trace_context import (
    bind_trace_context,
    ensure_trace_context,
    extract_trace_id_from_traceparent,
    reset_trace_context,
)


def create_trace_context_middleware():
    async def middleware(request: Request, call_next):
        state_trace_id = str(getattr(request.state, "trace_id", "") or "").strip()
        header_trace_id = str(request.headers.get("x-trace-id") or request.headers.get("x-request-id") or "").strip()
        parent_trace_id = extract_trace_id_from_traceparent(request.headers.get("traceparent"))
        raw_trace_id = state_trace_id or header_trace_id or parent_trace_id
        raw_correlation_id = (
            str(getattr(request.state, "correlation_id", "") or "").strip()
            or str(request.headers.get("x-correlation-id") or "").strip()
        )
        trace_id, correlation_id = ensure_trace_context(
            trace_id=raw_trace_id,
            correlation_id=raw_correlation_id,
        )
        request.state.trace_id = trace_id
        request.state.correlation_id = correlation_id
        tokens = bind_trace_context(trace_id=trace_id, correlation_id=correlation_id)
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id
            response.headers["X-Correlation-Id"] = correlation_id
            return response
        finally:
            reset_trace_context(tokens)

    return middleware
