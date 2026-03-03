from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.parser_service import AtomicTask
from app.services.task_executor_service import (
    TaskExecutionResult,
    TaskExecutorService,
    _TaskExecutionContext,
)
from app.services.universe_service import ProjectedAsteroid


def _context(*, asteroids: list[ProjectedAsteroid] | None = None) -> _TaskExecutionContext:
    async def _append_and_project_event(*, entity_id, event_type, payload):  # pragma: no cover - should not be called in these tests
        raise AssertionError(f"Unexpected event append: {event_type} {entity_id}")

    asteroid_map = {asteroid.id: asteroid for asteroid in (asteroids or [])}
    return _TaskExecutionContext(
        session=None,  # type: ignore[arg-type]
        user_id=uuid4(),
        galaxy_id=uuid4(),
        branch_id=None,
        result=TaskExecutionResult(),
        context_asteroid_ids=[],
        asteroids_by_id=asteroid_map,
        bonds_by_id={},
        contract_cache={},
        appended_events=[],
        append_and_project_event=_append_and_project_event,
    )


def _asteroid(*, value: str) -> ProjectedAsteroid:
    return ProjectedAsteroid(
        id=uuid4(),
        value=value,
        metadata={},
        is_deleted=False,
        created_at=datetime.now(timezone.utc),
        deleted_at=None,
        current_event_seq=1,
    )


def test_handle_ingest_update_family_ingest_reuses_existing_asteroid() -> None:
    service = TaskExecutorService()
    existing = _asteroid(value="Material")
    ctx = _context(asteroids=[existing])
    task = AtomicTask(action="INGEST", params={"value": "Material", "metadata": {}})

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.asteroids) == 1
    assert ctx.result.asteroids[0].id == existing.id
    assert ctx.context_asteroid_ids == [existing.id]


def test_handle_link_and_bond_mutation_family_requires_context_for_link() -> None:
    service = TaskExecutorService()
    ctx = _context(asteroids=[])
    task = AtomicTask(action="LINK", params={})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_link_and_bond_mutation_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert "LINK task requires" in str(exc.value.detail)


def test_handle_extinguish_family_rejects_invalid_bond_id() -> None:
    service = TaskExecutorService()
    ctx = _context(asteroids=[])
    task = AtomicTask(action="EXTINGUISH_BOND", params={"bond_id": "not-a-uuid"})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_extinguish_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert "valid bond_id" in str(exc.value.detail)


def test_handle_formula_guardian_select_family_selects_by_target_substring() -> None:
    service = TaskExecutorService()
    first = _asteroid(value="pipeline")
    second = _asteroid(value="trade")
    ctx = _context(asteroids=[first, second])
    task = AtomicTask(action="SELECT", params={"target": "pipe"})

    handled = asyncio.run(service._handle_formula_guardian_select_family(task=task, ctx=ctx))

    assert handled is True
    assert [item.id for item in ctx.result.selected_asteroids] == [first.id]
