from __future__ import annotations

from app.api.error_envelopes import resilience_error_detail


def test_resilience_error_detail_has_stable_shape() -> None:
    detail = resilience_error_detail(
        code="RATE_LIMIT_EXCEEDED",
        message="Too many requests.",
        service="http.rate_limiter",
        retry_after_seconds=12,
    )

    assert detail == {
        "code": "RATE_LIMIT_EXCEEDED",
        "message": "Too many requests.",
        "service": "http.rate_limiter",
        "retry_after_seconds": 12,
    }


def test_resilience_error_detail_accepts_additional_fields() -> None:
    detail = resilience_error_detail(
        code="CIRCUIT_OPEN",
        message="Outbox run is temporarily unavailable.",
        service="outbox.operator",
        trace_id="trace-x",
        correlation_id="corr-y",
    )

    assert detail["code"] == "CIRCUIT_OPEN"
    assert detail["service"] == "outbox.operator"
    assert detail["trace_id"] == "trace-x"
    assert detail["correlation_id"] == "corr-y"
