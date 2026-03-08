import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.runtime import ensure_onboarding_progress_safe, run_scoped_atomic_idempotent


class _NestedTransaction:
    def __init__(self, session: "_SessionStub") -> None:
        self._session = session

    async def __aenter__(self):
        self._session._in_tx = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self._session._in_tx = False
        return False


class _SessionStub:
    def __init__(self) -> None:
        self._in_tx = False

    def in_transaction(self) -> bool:
        return self._in_tx

    def begin(self):
        return _NestedTransaction(self)

    def begin_nested(self):
        return _NestedTransaction(self)


def test_ensure_onboarding_progress_safe_calls_service() -> None:
    session = _SessionStub()
    onboarding_service = SimpleNamespace(ensure_progress=AsyncMock(return_value=None))
    services = SimpleNamespace(onboarding_service=onboarding_service)

    asyncio.run(
        ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=uuid4(),
            galaxy_id=uuid4(),
            context="test.runtime",
        )
    )

    assert onboarding_service.ensure_progress.await_count == 1


def test_ensure_onboarding_progress_safe_swallows_sqlalchemy_error() -> None:
    session = _SessionStub()
    onboarding_service = SimpleNamespace(ensure_progress=AsyncMock(side_effect=SQLAlchemyError("db failure")))
    services = SimpleNamespace(onboarding_service=onboarding_service)

    asyncio.run(
        ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=uuid4(),
            galaxy_id=uuid4(),
            context="test.runtime.error",
        )
    )

    assert onboarding_service.ensure_progress.await_count == 1


def test_run_scoped_atomic_idempotent_executes_task_batch_and_maps_response() -> None:
    session = _SessionStub()

    user_id = uuid4()
    galaxy_id = uuid4()

    current_user = SimpleNamespace(id=user_id)
    resolved_galaxy = SimpleNamespace(id=galaxy_id)

    execution_result = SimpleNamespace(civilizations=[SimpleNamespace(id=uuid4(), value="ok")], bonds=[])

    auth_service = SimpleNamespace(resolve_user_galaxy=AsyncMock(return_value=resolved_galaxy))
    cosmos_service = SimpleNamespace(resolve_branch_id=AsyncMock(return_value=None))
    task_executor_service = SimpleNamespace(execute_tasks=AsyncMock(return_value=execution_result))
    services = SimpleNamespace(
        auth_service=auth_service,
        cosmos_service=cosmos_service,
        task_executor_service=task_executor_service,
    )

    tasks = [SimpleNamespace(action="INGEST", params={"value": "ok"})]

    async def _run():
        return await run_scoped_atomic_idempotent(
            session=session,  # type: ignore[arg-type]
            current_user=current_user,
            services=services,  # type: ignore[arg-type]
            tasks=tasks,  # type: ignore[arg-type]
            galaxy_id=None,
            branch_id=None,
            endpoint_key="POST:/civilizations/ingest",
            idempotency_key=None,
            request_payload={"value": "ok"},
            map_execution=lambda execution: {"value": execution.civilizations[0].value},
            replay_loader=lambda payload: payload,
            response_dumper=lambda response: response,
            empty_response_detail="failed",
        )

    response = asyncio.run(_run())

    assert response == {"value": "ok"}
    assert task_executor_service.execute_tasks.await_count == 1


def test_run_scoped_atomic_idempotent_uses_resolved_scope_without_lookup() -> None:
    session = _SessionStub()
    user_id = uuid4()
    resolved_galaxy_id = uuid4()

    current_user = SimpleNamespace(id=user_id)
    execution_result = SimpleNamespace(civilizations=[SimpleNamespace(id=uuid4(), value="ok")], bonds=[])

    auth_service = SimpleNamespace(resolve_user_galaxy=AsyncMock())
    cosmos_service = SimpleNamespace(resolve_branch_id=AsyncMock())
    task_executor_service = SimpleNamespace(execute_tasks=AsyncMock(return_value=execution_result))
    services = SimpleNamespace(
        auth_service=auth_service,
        cosmos_service=cosmos_service,
        task_executor_service=task_executor_service,
    )

    tasks = [SimpleNamespace(action="INGEST", params={"value": "ok"})]

    async def _run():
        return await run_scoped_atomic_idempotent(
            session=session,  # type: ignore[arg-type]
            current_user=current_user,
            services=services,  # type: ignore[arg-type]
            tasks=tasks,  # type: ignore[arg-type]
            galaxy_id=None,
            branch_id=None,
            endpoint_key="POST:/civilizations/ingest",
            idempotency_key=None,
            request_payload={"value": "ok"},
            map_execution=lambda execution: {"value": execution.civilizations[0].value},
            replay_loader=lambda payload: payload,
            response_dumper=lambda response: response,
            empty_response_detail="failed",
            resolved_scope=(resolved_galaxy_id, None),
        )

    response = asyncio.run(_run())

    assert response == {"value": "ok"}
    assert auth_service.resolve_user_galaxy.await_count == 0
    assert cosmos_service.resolve_branch_id.await_count == 0
    assert task_executor_service.execute_tasks.await_count == 1
