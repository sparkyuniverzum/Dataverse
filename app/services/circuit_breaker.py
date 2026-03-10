from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import TypeVar

T = TypeVar("T")


class CircuitBreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenError(RuntimeError):
    pass


@dataclass(frozen=True)
class CircuitBreakerSnapshot:
    state: CircuitBreakerState
    failure_count: int
    opened_at: float | None


class AsyncCircuitBreaker:
    def __init__(
        self,
        *,
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 30.0,
        time_provider: Callable[[], float] | None = None,
    ) -> None:
        self.failure_threshold = max(1, int(failure_threshold))
        self.recovery_timeout_seconds = max(0.1, float(recovery_timeout_seconds))
        self.time_provider = time_provider or __import__("time").time

        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._opened_at: float | None = None
        self._half_open_in_flight = False

    def snapshot(self) -> CircuitBreakerSnapshot:
        return CircuitBreakerSnapshot(
            state=self._state,
            failure_count=self._failure_count,
            opened_at=self._opened_at,
        )

    def _now(self) -> float:
        return float(self.time_provider())

    def _can_attempt_in_open(self) -> bool:
        if self._opened_at is None:
            return True
        return (self._now() - self._opened_at) >= self.recovery_timeout_seconds

    def _trip_open(self) -> None:
        self._state = CircuitBreakerState.OPEN
        self._opened_at = self._now()
        self._half_open_in_flight = False

    def _reset_closed(self) -> None:
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._opened_at = None
        self._half_open_in_flight = False

    async def call(self, operation: Callable[[], Awaitable[T]]) -> T:
        if self._state == CircuitBreakerState.OPEN:
            if not self._can_attempt_in_open():
                raise CircuitBreakerOpenError("Circuit breaker is open.")
            self._state = CircuitBreakerState.HALF_OPEN
            self._half_open_in_flight = False

        if self._state == CircuitBreakerState.HALF_OPEN and self._half_open_in_flight:
            raise CircuitBreakerOpenError("Circuit breaker half-open probe already in flight.")

        if self._state == CircuitBreakerState.HALF_OPEN:
            self._half_open_in_flight = True

        try:
            result = await operation()
        except Exception:
            if self._state == CircuitBreakerState.HALF_OPEN:
                self._trip_open()
            else:
                self._failure_count += 1
                if self._failure_count >= self.failure_threshold:
                    self._trip_open()
            raise
        else:
            self._reset_closed()
            return result
