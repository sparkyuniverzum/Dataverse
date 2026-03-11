from __future__ import annotations

import re
from contextvars import ContextVar, Token
from uuid import uuid4

_TRACE_ID_VAR: ContextVar[str | None] = ContextVar("dataverse_trace_id", default=None)
_CORRELATION_ID_VAR: ContextVar[str | None] = ContextVar("dataverse_correlation_id", default=None)

_TRACEPARENT_PATTERN = re.compile(r"^[\da-fA-F]{2}-(?P<trace_id>[\da-fA-F]{32})-[\da-fA-F]{16}-[\da-fA-F]{2}$")


def extract_trace_id_from_traceparent(header_value: str | None) -> str | None:
    candidate = str(header_value or "").strip()
    if not candidate:
        return None
    match = _TRACEPARENT_PATTERN.match(candidate)
    if match is None:
        return None
    trace_id = match.group("trace_id").lower()
    if trace_id == "0" * 32:
        return None
    return trace_id


def current_trace_context() -> tuple[str | None, str | None]:
    trace_id = _TRACE_ID_VAR.get()
    correlation_id = _CORRELATION_ID_VAR.get()
    if trace_id:
        return trace_id, correlation_id

    try:
        from opentelemetry import trace as otel_trace  # type: ignore[import-not-found]

        span = otel_trace.get_current_span()
        span_context = span.get_span_context()
        trace_value = int(getattr(span_context, "trace_id", 0) or 0)
        if trace_value > 0:
            return f"{trace_value:032x}", correlation_id
    except Exception:
        pass
    return None, correlation_id


def ensure_trace_context(
    *,
    trace_id: str | None,
    correlation_id: str | None,
) -> tuple[str, str]:
    normalized_trace_id = str(trace_id or "").strip() or uuid4().hex
    normalized_correlation_id = str(correlation_id or "").strip() or normalized_trace_id
    return normalized_trace_id, normalized_correlation_id


def bind_trace_context(*, trace_id: str, correlation_id: str) -> tuple[Token, Token]:
    trace_token = _TRACE_ID_VAR.set(str(trace_id))
    correlation_token = _CORRELATION_ID_VAR.set(str(correlation_id))
    return trace_token, correlation_token


def reset_trace_context(tokens: tuple[Token, Token]) -> None:
    trace_token, correlation_token = tokens
    _TRACE_ID_VAR.reset(trace_token)
    _CORRELATION_ID_VAR.reset(correlation_token)
