from __future__ import annotations

from app.services.trace_context import (
    bind_trace_context,
    current_trace_context,
    ensure_trace_context,
    extract_trace_id_from_traceparent,
    reset_trace_context,
)


def test_extract_trace_id_from_traceparent_parses_valid_header() -> None:
    trace_id = extract_trace_id_from_traceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
    assert trace_id == "4bf92f3577b34da6a3ce929d0e0e4736"


def test_extract_trace_id_from_traceparent_rejects_invalid_header() -> None:
    assert extract_trace_id_from_traceparent("not-a-traceparent") is None


def test_bind_and_reset_trace_context_roundtrip() -> None:
    before = current_trace_context()
    tokens = bind_trace_context(trace_id="trace-ctx", correlation_id="corr-ctx")
    assert current_trace_context() == ("trace-ctx", "corr-ctx")
    reset_trace_context(tokens)
    assert current_trace_context() == before


def test_ensure_trace_context_generates_trace_and_fallback_correlation() -> None:
    trace_id, correlation_id = ensure_trace_context(trace_id="", correlation_id="")
    assert isinstance(trace_id, str)
    assert trace_id != ""
    assert correlation_id == trace_id
