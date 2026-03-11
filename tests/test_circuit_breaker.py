from __future__ import annotations

import asyncio

import pytest

from app.infrastructure.runtime.observability.circuit_breaker import (
    AsyncCircuitBreaker,
    CircuitBreakerOpenError,
    CircuitBreakerState,
)


def test_circuit_breaker_opens_after_threshold_failures() -> None:
    breaker = AsyncCircuitBreaker(failure_threshold=2, recovery_timeout_seconds=10.0)

    async def fail():
        raise RuntimeError("downstream_error")

    with pytest.raises(RuntimeError):
        asyncio.run(breaker.call(fail))
    with pytest.raises(RuntimeError):
        asyncio.run(breaker.call(fail))

    snap = breaker.snapshot()
    assert snap.state == CircuitBreakerState.OPEN
    assert snap.failure_count == 2

    with pytest.raises(CircuitBreakerOpenError):
        asyncio.run(breaker.call(fail))


def test_circuit_breaker_half_open_recovery_after_timeout() -> None:
    now = {"t": 100.0}

    def time_provider() -> float:
        return now["t"]

    breaker = AsyncCircuitBreaker(
        failure_threshold=1,
        recovery_timeout_seconds=5.0,
        time_provider=time_provider,
    )

    async def fail():
        raise RuntimeError("downstream_error")

    with pytest.raises(RuntimeError):
        asyncio.run(breaker.call(fail))
    assert breaker.snapshot().state == CircuitBreakerState.OPEN

    with pytest.raises(CircuitBreakerOpenError):
        asyncio.run(breaker.call(fail))

    now["t"] = 106.0

    async def success():
        return "ok"

    result = asyncio.run(breaker.call(success))
    assert result == "ok"
    snap = breaker.snapshot()
    assert snap.state == CircuitBreakerState.CLOSED
    assert snap.failure_count == 0
