import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser_types import AtomicTask
from app.services.task_executor.preview import execute_atomic_tasks_preview


class _NestedTransaction:
    def __init__(self, session: "_SessionStub") -> None:
        self._session = session

    async def __aenter__(self):
        self._session._in_tx = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self._session._in_tx = False
        return False

    async def rollback(self):
        self._session.rollback_count += 1


class _SessionStub:
    def __init__(self) -> None:
        self._in_tx = False
        self.rollback_count = 0

    def in_transaction(self) -> bool:
        return self._in_tx

    def begin(self):
        return _NestedTransaction(self)

    def begin_nested(self):
        return _NestedTransaction(self)


def test_execute_atomic_tasks_preview_runs_executor_and_rolls_back() -> None:
    session = _SessionStub()
    execution_result = SimpleNamespace(civilizations=[SimpleNamespace(id=uuid4())], bonds=[])
    task_executor_service = SimpleNamespace(execute_tasks=AsyncMock(return_value=execution_result))
    services = SimpleNamespace(task_executor_service=task_executor_service)
    tasks = [AtomicTask(action="INGEST", params={"value": "A"})]

    response = asyncio.run(
        execute_atomic_tasks_preview(
            session=session,  # type: ignore[arg-type]
            services=services,
            tasks=tasks,
            user_id=uuid4(),
            galaxy_id=uuid4(),
            branch_id=None,
        )
    )

    assert response is execution_result
    assert task_executor_service.execute_tasks.await_count == 1
    assert session.rollback_count == 1
