from __future__ import annotations

from pathlib import Path

_EXECUTOR_IMPL_PATH = Path(__file__).resolve().parents[2] / "services" / "task_executor"
if _EXECUTOR_IMPL_PATH.exists():
    executor_impl_path = str(_EXECUTOR_IMPL_PATH)
    if executor_impl_path not in __path__:
        __path__.append(executor_impl_path)

from .models import TaskExecutionResult  # noqa: E402
from .preview import execute_atomic_tasks_preview  # noqa: E402
from .service import TaskExecutorService  # noqa: E402

__all__ = [
    "TaskExecutionResult",
    "TaskExecutorService",
    "execute_atomic_tasks_preview",
]
