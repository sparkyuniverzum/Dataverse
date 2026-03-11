from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.task_executor.models import (
    TaskExecutionResult,
)
from app.core.task_executor.service import (
    TaskExecutorService,
    _TaskExecutionContext,
)
from app.infrastructure.runtime.parser2.intents import (
    NodeSelector,
    NodeSelectorType,
    UpsertNodeIntent,
)
from app.services.parser_types import AtomicTask
from app.services.universe_service import ProjectedCivilization


def _context(*, civilizations: list[ProjectedCivilization] | None = None) -> _TaskExecutionContext:
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
        civilizations_by_id=asteroid_map,
        bonds_by_id={},
        contract_cache={},
        appended_events=[],
        append_and_project_event=_append_and_project_event,
    )


def _asteroid(*, value: str, metadata: dict | None = None) -> ProjectedCivilization:
    return ProjectedCivilization(
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
        if event_type != "CIVILIZATION_CREATED":
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
    assert "CIVILIZATION_UPSERTED" in codes
    assert "PLANET_INFERRED" in codes
    confidence_by_code = {str(item.get("code")): str(item.get("confidence")) for item in ctx.result.semantic_effects}
    assert confidence_by_code.get("CIVILIZATION_UPSERTED") == "certain"
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
    assert [item.id for item in ctx.result.selected_civilizations] == [first.id]


def test_normalize_runtime_tasks_bridges_single_intent_to_atomic_task() -> None:
    service = TaskExecutorService()
    intent = UpsertNodeIntent(
        node=NodeSelector(selector_type=NodeSelectorType.NAME, value="Alice"),
        metadata={"state": "active"},
    )

    normalized = service._normalize_runtime_tasks(tasks=[intent])

    assert len(normalized) == 1
    assert normalized[0].action == "INGEST"
    assert normalized[0].params["value"] == "Alice"
    assert normalized[0].params["metadata"]["state"] == "active"


def test_normalize_runtime_tasks_rejects_unbridgeable_intent() -> None:
    service = TaskExecutorService()
    # ID selector must be valid UUID, so this intent must fail bridge->AtomicTask conversion.
    intent = UpsertNodeIntent(
        node=NodeSelector(selector_type=NodeSelectorType.ID, value="not-a-uuid"),
        metadata={},
    )

    with pytest.raises(HTTPException) as exc:
        service._normalize_runtime_tasks(tasks=[intent])

    assert exc.value.status_code == 422
    assert "Invalid parser intent" in str(exc.value.detail)


def test_update_asteroid_blocks_non_lifecycle_mutation_on_archived_row() -> None:
    service = TaskExecutorService()
    archived = _asteroid(value="Archived Item", metadata={"state": "archived", "segment": "legacy"})
    ctx = _context(civilizations=[archived])
    task = AtomicTask(
        action="UPDATE_CIVILIZATION",
        params={"civilization_id": str(archived.id), "metadata": {"segment": "new"}},
    )

    async def _noop_expected(**kwargs):  # noqa: ANN003
        return None

    service._enforce_expected_entity_event_seq = _noop_expected  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("code") == "LIFECYCLE_TRANSITION_BLOCKED"
    assert exc.value.detail.get("reason") == "archived_readonly"


def test_update_asteroid_blocks_invalid_lifecycle_transition() -> None:
    service = TaskExecutorService()
    archived = _asteroid(value="Archived Item", metadata={"state": "archived"})
    ctx = _context(civilizations=[archived])
    task = AtomicTask(
        action="UPDATE_CIVILIZATION",
        params={"civilization_id": str(archived.id), "metadata": {"state": "active"}},
    )

    async def _noop_expected(**kwargs):  # noqa: ANN003
        return None

    service._enforce_expected_entity_event_seq = _noop_expected  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert exc.value.status_code == 422
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("code") == "LIFECYCLE_TRANSITION_BLOCKED"
    assert exc.value.detail.get("reason") == "invalid_transition"
    assert exc.value.detail.get("from_state") == "ARCHIVED"


def test_update_asteroid_allows_active_to_archived_transition() -> None:
    service = TaskExecutorService()
    active = _asteroid(value="Active Item", metadata={"state": "active"})
    ctx = _context(civilizations=[active])
    task = AtomicTask(
        action="UPDATE_CIVILIZATION",
        params={"civilization_id": str(active.id), "metadata": {"state": "archived"}},
    )
    seq = {"value": int(active.current_event_seq)}

    async def _noop_expected(**kwargs):  # noqa: ANN003
        return None

    async def _noop_validate(**kwargs):  # noqa: ANN003
        return None

    async def _noop_auto_semantics(**kwargs):  # noqa: ANN003
        return None

    async def _append_event(*, entity_id, event_type, payload):  # noqa: ANN001
        seq["value"] += 1
        return type("Evt", (), {"timestamp": datetime.now(UTC), "event_seq": seq["value"]})

    service._enforce_expected_entity_event_seq = _noop_expected  # type: ignore[method-assign]
    service._validate_table_contract_write = _noop_validate  # type: ignore[method-assign]
    service._apply_auto_semantics_for_civilization = _noop_auto_semantics  # type: ignore[method-assign]
    ctx.append_and_project_event = _append_event  # type: ignore[assignment]

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert ctx.result.civilizations
    assert ctx.result.civilizations[0].metadata.get("state") == "archived"


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
        service._load_auto_semantic_rules_for_civilization(
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
        if event_type not in {"CIVILIZATION_CREATED", "METADATA_UPDATED"}:
            raise AssertionError(f"Unexpected event append: {event_type} {entity_id}")
        event_seq = 2 if event_type == "CIVILIZATION_CREATED" else 3
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
    service._load_auto_semantic_rules_for_civilization = _fake_rules  # type: ignore[method-assign]
    ctx.append_and_project_event = _append_and_project_event  # type: ignore[assignment]

    handled = asyncio.run(service._handle_ingest_update_family(task=task, ctx=ctx))

    assert handled is True
    assert len(ctx.result.civilizations) == 1
    created = ctx.result.civilizations[0]
    assert created.metadata.get("table") == "HR > Zamestnanci"
    assert created.metadata.get("table_name") == "HR > Zamestnanci"
    confidence_by_code = {str(item.get("code")): str(item.get("confidence")) for item in ctx.result.semantic_effects}
    assert "CIVILIZATION_RECLASSIFIED" in confidence_by_code
    assert confidence_by_code.get("CIVILIZATION_RECLASSIFIED") == "certain"
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
        task_action="UPDATE_CIVILIZATION",
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
