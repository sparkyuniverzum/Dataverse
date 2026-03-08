from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.parser_service import AtomicTask
from app.services.task_executor_service import (
    TaskExecutionResult,
    TaskExecutorService,
    _TaskExecutionContext,
)
from app.services.universe_service import ProjectedAsteroid


def _context(*, civilizations: list[ProjectedAsteroid] | None = None) -> _TaskExecutionContext:
    async def _append_and_project_event(
        *, entity_id, event_type, payload
    ):  # pragma: no cover - should not be called in these tests
        raise AssertionError(f"Unexpected event append: {event_type} {entity_id}")

    asteroid_map = {civilization.id: civilization for civilization in (civilizations or [])}
    return _TaskExecutionContext(
        session=None,  # type: ignore[arg-type]
        user_id=uuid4(),
        galaxy_id=uuid4(),
        branch_id=None,
        result=TaskExecutionResult(),
        context_civilization_ids=[],
        asteroids_by_id=asteroid_map,
        bonds_by_id={},
        contract_cache={},
        appended_events=[],
        append_and_project_event=_append_and_project_event,
    )


def _asteroid(*, value: str, metadata: dict | None = None) -> ProjectedAsteroid:
    return ProjectedAsteroid(
        id=uuid4(),
        value=value,
        metadata=metadata or {},
        is_deleted=False,
        created_at=datetime.now(UTC),
        deleted_at=None,
        current_event_seq=1,
    )


def test_handle_ingest_update_family_ingest_reuses_existing_asteroid() -> None:
    service = TaskExecutorService()
    existing = _asteroid(value="Material")
    ctx = _context(civilizations=[existing])
    task = AtomicTask(action="INGEST", params={"value": "Material", "metadata": {}})

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.civilizations) == 1
    assert ctx.result.civilizations[0].id == existing.id
    assert ctx.context_civilization_ids == [existing.id]


def test_handle_ingest_update_family_ingest_does_not_reuse_existing_from_other_table() -> None:
    service = TaskExecutorService()
    existing = _asteroid(value="Material", metadata={"table": "Sklad > Material"})
    ctx = _context(civilizations=[existing])
    task = AtomicTask(action="INGEST", params={"value": "Material", "metadata": {"table": "Finance > Material"}})

    async def _append_and_project_event(*, entity_id, event_type, payload):  # noqa: ANN001
        if event_type != "ASTEROID_CREATED":
            raise AssertionError(f"Unexpected event append: {event_type} {entity_id}")
        return type("Evt", (), {"timestamp": datetime.now(UTC), "event_seq": 2})

    async def _noop_validate(**kwargs):  # noqa: ANN003
        return None

    service._validate_table_contract_write = _noop_validate  # type: ignore[method-assign]
    ctx.append_and_project_event = _append_and_project_event  # type: ignore[assignment]

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.civilizations) == 1
    created = ctx.result.civilizations[0]
    assert created.id != existing.id
    assert created.metadata.get("table") == "Finance > Material"
    assert ctx.context_civilization_ids == [created.id]
    codes = [str(item.get("code")) for item in ctx.result.semantic_effects]
    assert "MOON_UPSERTED" in codes
    assert "PLANET_INFERRED" in codes
    confidence_by_code = {str(item.get("code")): str(item.get("confidence")) for item in ctx.result.semantic_effects}
    assert confidence_by_code.get("MOON_UPSERTED") == "certain"
    assert confidence_by_code.get("PLANET_INFERRED") == "high"
    assert all(str(item.get("because") or "").strip() for item in ctx.result.semantic_effects)


def test_handle_link_and_bond_mutation_family_requires_context_for_link() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])
    task = AtomicTask(action="LINK", params={})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_link_and_bond_mutation_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert "LINK task requires" in str(exc.value.detail)


def test_handle_extinguish_family_rejects_invalid_bond_id() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])
    task = AtomicTask(action="EXTINGUISH_BOND", params={"bond_id": "not-a-uuid"})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_extinguish_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert "valid bond_id" in str(exc.value.detail)


def test_handle_formula_guardian_select_family_selects_by_target_substring() -> None:
    service = TaskExecutorService()
    first = _asteroid(value="pipeline")
    second = _asteroid(value="trade")
    ctx = _context(civilizations=[first, second])
    task = AtomicTask(action="SELECT", params={"target": "pipe"})

    handled = asyncio.run(service._handle_formula_guardian_select_family(task=task, ctx=ctx))

    assert handled is True
    assert [item.id for item in ctx.result.selected_asteroids] == [first.id]


def test_build_preload_plan_partial_for_id_only_tasks() -> None:
    service = TaskExecutorService()
    source_civilization_id = uuid4()
    target_civilization_id = uuid4()
    bond_id = uuid4()
    civilization_id = uuid4()
    tasks = [
        AtomicTask(
            action="LINK",
            params={
                "source_civilization_id": str(source_civilization_id),
                "target_civilization_id": str(target_civilization_id),
                "type": "RELATION",
            },
        ),
        AtomicTask(action="EXTINGUISH_BOND", params={"bond_id": str(bond_id)}),
        AtomicTask(action="UPDATE_ASTEROID", params={"civilization_id": str(civilization_id), "metadata": {"x": 1}}),
        AtomicTask(action="SET_FORMULA", params={"target": str(civilization_id), "field": "f", "formula": "=1"}),
        AtomicTask(
            action="ADD_GUARDIAN",
            params={"target": str(civilization_id), "field": "f", "operator": ">", "threshold": 1, "action": "alert"},
        ),
    ]

    plan = service._build_preload_plan(tasks=tasks, branch_id=None)

    assert plan.scope == "partial"
    assert source_civilization_id in plan.civilization_ids
    assert target_civilization_id in plan.civilization_ids
    assert civilization_id in plan.civilization_ids
    assert bond_id in plan.bond_ids
    assert plan.include_connected_bonds is False


def test_build_preload_plan_partial_for_ingest_only_batch() -> None:
    service = TaskExecutorService()
    tasks = [AtomicTask(action="INGEST", params={"value": "Material", "metadata": {"table": "Sklad"}})]

    plan = service._build_preload_plan(tasks=tasks, branch_id=None)

    assert plan.scope == "partial"
    assert plan.civilization_ids == frozenset()
    assert plan.bond_ids == frozenset()
    assert plan.include_connected_bonds is False


def test_build_preload_plan_partial_for_explicit_extinguish() -> None:
    service = TaskExecutorService()
    civilization_id = uuid4()
    tasks = [AtomicTask(action="EXTINGUISH", params={"civilization_id": str(civilization_id)})]

    plan = service._build_preload_plan(tasks=tasks, branch_id=None)

    assert plan.scope == "partial"
    assert civilization_id in plan.civilization_ids
    assert plan.include_connected_bonds is True


def test_build_preload_plan_falls_back_for_fuzzy_or_branch_tasks() -> None:
    service = TaskExecutorService()
    fuzzy_tasks = [AtomicTask(action="DELETE", params={"target": "pipeline"})]
    branch_tasks = [
        AtomicTask(
            action="LINK", params={"source_civilization_id": str(uuid4()), "target_civilization_id": str(uuid4())}
        )
    ]

    fuzzy_plan = service._build_preload_plan(tasks=fuzzy_tasks, branch_id=None)
    branch_plan = service._build_preload_plan(tasks=branch_tasks, branch_id=uuid4())

    assert fuzzy_plan.scope == "full"
    assert branch_plan.scope == "full"


def test_handle_ingest_update_family_partial_scope_reuses_existing_from_db_lookup() -> None:
    service = TaskExecutorService()
    existing = _asteroid(value="Material")
    ctx = _context(civilizations=[])
    ctx.preload_scope = "partial"
    task = AtomicTask(action="INGEST", params={"value": "Material", "metadata": {}})

    async def _fake_lookup(*, session, user_id, galaxy_id, value):  # noqa: ANN001
        assert value == "Material"
        return existing

    service._load_active_asteroid_by_value = _fake_lookup  # type: ignore[method-assign]

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.civilizations) == 1
    assert ctx.result.civilizations[0].id == existing.id
    assert ctx.context_civilization_ids == [existing.id]
    assert existing.id in ctx.asteroids_by_id


def test_load_auto_semantic_rules_reads_from_physics_defaults_registry() -> None:
    service = TaskExecutorService()
    civilization = _asteroid(value="Alice", metadata={"table": "General > People"})

    fake_contract = type(
        "Contract",
        (),
        {
            "physics_rulebook": {
                "defaults": {
                    "auto_semantics": [
                        {
                            "id": "role-employee",
                            "kind": "bucket_by_metadata_value",
                            "field": "role",
                            "in": ["employee", "zamestnanec"],
                            "target_constellation": "HR",
                            "target_planet": "Zamestnanci",
                        }
                    ]
                }
            },
            "validators": [],
        },
    )()

    async def _fake_load_latest(**kwargs):  # noqa: ANN003
        return fake_contract

    service._load_latest_table_contract = _fake_load_latest  # type: ignore[method-assign]
    rules = asyncio.run(
        service._load_auto_semantic_rules_for_asteroid(
            session=object(),  # type: ignore[arg-type]
            galaxy_id=uuid4(),
            civilization=civilization,
            contract_cache={},
        )
    )

    assert len(rules) == 1
    assert rules[0]["id"] == "role-employee"


def test_handle_ingest_update_family_applies_auto_semantic_reclassification() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])
    task = AtomicTask(
        action="INGEST", params={"value": "Alice", "metadata": {"table": "General > People", "role": "employee"}}
    )

    async def _append_and_project_event(*, entity_id, event_type, payload):  # noqa: ANN001
        if event_type not in {"ASTEROID_CREATED", "METADATA_UPDATED"}:
            raise AssertionError(f"Unexpected event append: {event_type} {entity_id}")
        event_seq = 2 if event_type == "ASTEROID_CREATED" else 3
        return type("Evt", (), {"timestamp": datetime.now(UTC), "event_seq": event_seq})

    async def _noop_validate(**kwargs):  # noqa: ANN003
        return None

    async def _fake_rules(**kwargs):  # noqa: ANN003
        return [
            {
                "id": "role-employee",
                "kind": "bucket_by_metadata_value",
                "field": "role",
                "in": ["employee"],
                "target_constellation": "HR",
                "target_planet": "Zamestnanci",
            }
        ]

    service._validate_table_contract_write = _noop_validate  # type: ignore[method-assign]
    service._load_auto_semantic_rules_for_asteroid = _fake_rules  # type: ignore[method-assign]
    ctx.append_and_project_event = _append_and_project_event  # type: ignore[assignment]

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.civilizations) == 1
    created = ctx.result.civilizations[0]
    assert created.metadata.get("table") == "HR > Zamestnanci"
    assert created.metadata.get("table_name") == "HR > Zamestnanci"
    confidence_by_code = {str(item.get("code")): str(item.get("confidence")) for item in ctx.result.semantic_effects}
    assert "MOON_RECLASSIFIED" in confidence_by_code
    assert confidence_by_code.get("MOON_RECLASSIFIED") == "certain"
    if "PLANET_INFERRED" in confidence_by_code:
        assert confidence_by_code.get("PLANET_INFERRED") == "high"
    assert all(str(item.get("because") or "").strip() for item in ctx.result.semantic_effects)


def test_record_semantic_effect_confidence_policy_sets_high_and_medium_defaults() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])

    service._record_semantic_effect(
        ctx=ctx,
        code="BOND_REUSED",
        reason="reused",
        task_action="LINK",
    )
    service._record_semantic_effect(
        ctx=ctx,
        code="ROW_CONFLICT",
        reason="conflict",
        task_action="INGEST",
    )
    service._record_semantic_effect(
        ctx=ctx,
        code="ANY_EFFECT",
        reason="warning branch",
        task_action="UPDATE_ASTEROID",
        severity="warning",
    )

    assert str(ctx.result.semantic_effects[0].get("confidence")) == "high"
    assert str(ctx.result.semantic_effects[1].get("confidence")) == "medium"
    assert str(ctx.result.semantic_effects[2].get("confidence")) == "medium"


def test_ensure_transaction_ready_rejects_missing_external_transaction() -> None:
    service = TaskExecutorService()

    class _Session:
        @staticmethod
        def in_transaction() -> bool:
            return False

    with pytest.raises(HTTPException) as exc:
        service._ensure_transaction_ready(session=_Session(), manage_transaction=False)  # type: ignore[arg-type]

    assert exc.value.status_code == 500
    assert "active transaction" in str(exc.value.detail)


def test_resolve_transaction_context_prefers_nested_for_active_transaction() -> None:
    service = TaskExecutorService()

    class _Token:
        pass

    class _Session:
        def __init__(self) -> None:
            self.used_begin = False
            self.used_begin_nested = False

        @staticmethod
        def in_transaction() -> bool:
            return True

        def begin(self):  # noqa: ANN201
            self.used_begin = True
            return _Token()

        def begin_nested(self):  # noqa: ANN201
            self.used_begin_nested = True
            return _Token()

    session = _Session()
    token = service._resolve_transaction_context(session=session, manage_transaction=True)

    assert isinstance(token, _Token)
    assert session.used_begin_nested is True
    assert session.used_begin is False


def test_run_task_sequence_raises_on_unsupported_atomic_task() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])
    tasks = [AtomicTask(action="UNKNOWN_ACTION", params={})]

    async def _always_unhandled(*, task, ctx):  # noqa: ANN001, ARG001
        return False

    service._dispatch_task_family = _always_unhandled  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._run_task_sequence(tasks=tasks, ctx=ctx))

    assert exc.value.status_code == 422
    assert "Unsupported task action" in str(exc.value.detail)


def test_sync_read_model_if_needed_skips_for_branch_scope() -> None:
    service = TaskExecutorService()
    ctx = _context(civilizations=[])
    ctx.branch_id = uuid4()
    ctx.appended_events = [object()]  # type: ignore[list-item]

    class _Projector:
        def __init__(self) -> None:
            self.calls = 0

        async def apply_events(self, *, session, events):  # noqa: ANN001, ANN201
            del session, events
            self.calls += 1

    projector = _Projector()
    service.read_model_projector = projector  # type: ignore[assignment]

    asyncio.run(service._sync_read_model_if_needed(branch_id=ctx.branch_id, ctx=ctx))

    assert projector.calls == 0
