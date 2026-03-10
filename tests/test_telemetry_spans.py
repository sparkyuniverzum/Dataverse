from __future__ import annotations

from app.services.telemetry_spans import start_span


def test_start_span_is_safe_when_otel_is_unavailable_or_not_configured() -> None:
    with start_span("test.span", attributes={"k": "v"}):
        marker = "ok"

    assert marker == "ok"
