from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AtomicTask:
    # Parser output only: syntactic command translation into atomic tasks.
    action: str
    params: dict[str, Any]


@dataclass(frozen=True)
class ParseResult:
    tasks: list[AtomicTask]
    errors: list[str]
