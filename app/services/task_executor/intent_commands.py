from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.parser_types import AtomicTask


class IntentCommandValidationError(ValueError):
    pass


@dataclass(frozen=True)
class IntentCommand:
    action: str
    params: dict[str, Any]
    source: str = "atomic_task"


def intent_command_from_atomic_task(task: AtomicTask) -> IntentCommand:
    action = str(task.action or "").strip().upper()
    if not action:
        raise IntentCommandValidationError("AtomicTask action must be non-empty")
    if not isinstance(task.params, dict):
        raise IntentCommandValidationError("AtomicTask params must be a dict")
    return IntentCommand(action=action, params=dict(task.params), source="atomic_task")
