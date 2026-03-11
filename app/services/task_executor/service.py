from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.bonds.semantics import normalize_bond_type
from app.infrastructure.runtime.event_store_service import EventStoreService
from app.infrastructure.runtime.parser2.bridge import Parser2ExecutorBridge
from app.infrastructure.runtime.parser2.intents import (
    AddGuardianIntent,
    AssignAttributeIntent,
    BulkIntent,
    CreateLinkIntent,
    ExtinguishNodeIntent,
    FlowIntent,
    IntentEnvelope,
    SelectNodesIntent,
    SetFormulaIntent,
    UpsertNodeIntent,
)
from app.models import Bond, Event
from app.services.auto_semantics_service import AutoSemanticsService
from app.services.parser_types import AtomicTask
from app.services.projection.read_model_projector import ReadModelProjector
from app.services.table_contract_effective import EffectiveTableContract
from app.services.task_executor.contract_validation import TableContractValidator
from app.services.task_executor.families.bond_mutation import handle_link_and_bond_mutation_family
from app.services.task_executor.families.extinguish import handle_extinguish_family
from app.services.task_executor.families.formula_guardian_select import handle_formula_guardian_select_family
from app.services.task_executor.families.ingest_update import handle_ingest_update_family
from app.services.task_executor.intent_commands import (
    IntentCommandValidationError,
    intent_command_from_atomic_task,
)
from app.services.task_executor.models import TaskExecutionResult
from app.services.task_executor.occ_guards import OccGuards
from app.services.task_executor.target_resolution import TargetResolver
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedBond,
    ProjectedCivilization,
    UniverseService,
    derive_table_id,
    derive_table_name,
)


@dataclass
class _TaskExecutionContext:
    session: AsyncSession
    user_id: UUID
    galaxy_id: UUID
    branch_id: UUID | None
    result: TaskExecutionResult
    context_civilization_ids: list[UUID]
    civilizations_by_id: dict[UUID, ProjectedCivilization]
    bonds_by_id: dict[UUID, ProjectedBond]
    contract_cache: dict[UUID, EffectiveTableContract | None]
    appended_events: list[Event]
    append_and_project_event: Callable[..., Awaitable[Event]]


InputTask = (
    AtomicTask
    | UpsertNodeIntent
    | CreateLinkIntent
    | AssignAttributeIntent
    | FlowIntent
    | ExtinguishNodeIntent
    | SelectNodesIntent
    | SetFormulaIntent
    | AddGuardianIntent
    | BulkIntent
)
PARSER_INTENT_TYPES = (
    UpsertNodeIntent,
    CreateLinkIntent,
    AssignAttributeIntent,
    FlowIntent,
    ExtinguishNodeIntent,
    SelectNodesIntent,
    SetFormulaIntent,
    AddGuardianIntent,
    BulkIntent,
)


class TaskExecutorService:
    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        universe_service: UniverseService | None = None,
        read_model_projector: ReadModelProjector | None = None,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.universe_service = universe_service or UniverseService(event_store=self.event_store)
        self.read_model_projector = read_model_projector or ReadModelProjector()
        self.target_resolver = TargetResolver()
        self.occ_guards = OccGuards()
        self.contract_validator = TableContractValidator()
        self.auto_semantics_service = AutoSemanticsService(self)
        self.parser2_executor_bridge = Parser2ExecutorBridge()
        self.atomic_family_handlers = (
            self._handle_ingest_update_family,
            self._handle_link_and_bond_mutation_family,
            self._handle_extinguish_family,
            self._handle_formula_guardian_select_family,
        )
        self._active_executions = 0
        self._active_executions_lock = asyncio.Lock()
        self._idle_event = asyncio.Event()
        self._idle_event.set()

    @asynccontextmanager
    async def _track_execution(self):
        async with self._active_executions_lock:
            self._active_executions += 1
            self._idle_event.clear()
        try:
            yield
        finally:
            async with self._active_executions_lock:
                self._active_executions = max(0, int(self._active_executions) - 1)
                if self._active_executions == 0:
                    self._idle_event.set()

    async def wait_for_idle(self, *, timeout_seconds: float = 10.0) -> bool:
        normalized_timeout = max(0.0, float(timeout_seconds))
        if self._idle_event.is_set():
            return True
        try:
            await asyncio.wait_for(self._idle_event.wait(), timeout=normalized_timeout)
            return True
        except TimeoutError:
            return False

    @staticmethod
    def _to_jsonable_dict(payload: dict[str, Any] | None) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        normalized: dict[str, Any] = {}
        for key, value in payload.items():
            if isinstance(value, UUID):
                normalized[str(key)] = str(value)
            elif isinstance(value, datetime):
                normalized[str(key)] = value.astimezone(UTC).isoformat()
            elif isinstance(value, list):
                normalized[str(key)] = [str(item) if isinstance(item, UUID) else item for item in value]
            else:
                normalized[str(key)] = value
        return normalized

    @staticmethod
    def _default_semantic_because(
        *,
        code: str,
        task_action: str,
        rule_id: str | None,
        inputs: dict[str, Any] | None,
        outputs: dict[str, Any] | None,
    ) -> str:
        normalized_code = str(code or "").strip().upper()
        normalized_action = str(task_action or "").strip().upper()
        normalized_rule = str(rule_id or "").strip()
        safe_inputs = inputs if isinstance(inputs, dict) else {}
        safe_outputs = outputs if isinstance(outputs, dict) else {}

        if normalized_code == "MOON_UPSERTED":
            return "Zadany zaznam prosel pres idempotentni upsert (vytvoreni nebo synchronizace existujiciho mesice)."
        if normalized_code == "MOON_UPDATED":
            return "Executor zapsal zmenu hodnoty nebo metadata do existujiciho mesice."
        if normalized_code == "MOON_RECLASSIFIED":
            from_table = str(safe_inputs.get("from_table_name") or "").strip()
            to_table = str(safe_inputs.get("to_table_name") or "").strip()
            if from_table and to_table:
                return f"Klasifikace se zmenila z '{from_table}' na '{to_table}'."
            return "Klasifikace mesice se zmenila na jinou planetu/tabulku."
        if normalized_code == "PLANET_INFERRED":
            table_name = str(safe_inputs.get("table_name") or safe_outputs.get("planet_name") or "").strip()
            if table_name:
                return f"Po zpracovani vznikl novy aktivni planetarni bucket '{table_name}'."
            return "Po zpracovani vznikl novy aktivni planetarni bucket, ktery drive neexistoval."
        if normalized_code == "BOND_CREATED":
            bond_type = str(safe_inputs.get("type") or "RELATION").strip().upper()
            return f"Pro danou dvojici uzlu neexistovala aktivni vazba typu {bond_type}, proto byla vytvorena."
        if normalized_code == "BOND_REUSED":
            return "Aktivni vazba uz existovala, executor ji znovu pouzil bez vytvareni duplicity."
        if normalized_code == "BOND_RETYPED":
            return "Typ vazby se meni soft-replace postupem: stara vazba se zhasne a zalozi se nova kanonicka vazba."
        if normalized_code == "BOND_EXTINGUISHED":
            return "Vazba byla zhasnuta soft-delete pravidlem (bez hard delete)."
        if normalized_code == "MOON_EXTINGUISHED":
            return "Mesic byl zhasnut soft-delete pravidlem (bez hard delete)."
        if normalized_code == "FORMULA_SET":
            return "Vzorec byl ulozen jako metadata pravidlo ciloveho mesice."
        if normalized_code == "GUARDIAN_ADDED":
            return "Guardian pravidlo bylo pridano do metadata kontraktu ciloveho mesice."

        if normalized_rule:
            return f"Efekt vznikl podle pravidla '{normalized_rule}' pri akci {normalized_action or 'UNKNOWN'}."
        if normalized_action:
            return f"Efekt vznikl pri akci {normalized_action}."
        return "Efekt vznikl pri zpracovani tasku executorem."

    @staticmethod
    def _default_semantic_confidence(
        *,
        code: str,
        severity: str,
    ) -> str:
        normalized_code = str(code or "").strip().upper()
        normalized_severity = str(severity or "info").strip().lower()

        if "CONFLICT" in normalized_code:
            return "medium"
        if normalized_severity in {"warning", "error", "critical"}:
            return "medium"
        if normalized_code in {"PLANET_INFERRED", "BOND_REUSED"}:
            return "high"
        return "certain"

    def _record_semantic_effect(
        self,
        *,
        ctx: _TaskExecutionContext,
        code: str,
        reason: str,
        task_action: str,
        rule_id: str | None = None,
        severity: str = "info",
        confidence: str | None = None,
        because: str | None = None,
        inputs: dict[str, Any] | None = None,
        outputs: dict[str, Any] | None = None,
    ) -> None:
        if confidence is None:
            normalized_confidence = self._default_semantic_confidence(
                code=code,
                severity=severity,
            )
        else:
            normalized_confidence = str(confidence or "").strip().lower()
        if not normalized_confidence:
            normalized_confidence = "certain"
        if normalized_confidence not in {"certain", "high", "medium", "likely"}:
            normalized_confidence = "likely"
        normalized_because = str(because).strip() if isinstance(because, str) and str(because).strip() else None
        if not normalized_because:
            normalized_because = self._default_semantic_because(
                code=code,
                task_action=task_action,
                rule_id=rule_id,
                inputs=inputs,
                outputs=outputs,
            )
        effect = {
            "id": str(uuid4()),
            "timestamp": datetime.now(UTC).isoformat(),
            "code": str(code).strip().upper(),
            "severity": str(severity).strip().lower() or "info",
            "confidence": normalized_confidence,
            "because": normalized_because,
            "rule_id": str(rule_id).strip() if isinstance(rule_id, str) and rule_id.strip() else None,
            "reason": str(reason).strip(),
            "task_action": str(task_action).strip().upper(),
            "inputs": self._to_jsonable_dict(inputs),
            "outputs": self._to_jsonable_dict(outputs),
        }
        ctx.result.semantic_effects.append(effect)

    async def _apply_auto_semantics_for_civilization(
        self,
        *,
        ctx: _TaskExecutionContext,
        civilization: ProjectedCivilization,
        trigger_action: str,
    ) -> None:
        await self.auto_semantics_service.apply_auto_semantics_for_civilization(
            ctx=ctx,
            civilization=civilization,
            trigger_action=trigger_action,
        )

    @staticmethod
    def _bond_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        source_civilization_id: UUID,
        target_civilization_id: UUID,
        bond_type: str,
    ) -> int:
        return OccGuards.bond_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            source_civilization_id=source_civilization_id,
            target_civilization_id=target_civilization_id,
            bond_type=bond_type,
        )

    @staticmethod
    def _occ_scope_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> int:
        return OccGuards.occ_scope_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )

    @staticmethod
    def _to_projected_bond(bond: Bond, *, current_event_seq: int = 0) -> ProjectedBond:
        return ProjectedBond(
            id=bond.id,
            source_civilization_id=bond.source_civilization_id,
            target_civilization_id=bond.target_civilization_id,
            type=normalize_bond_type(bond.type),
            is_deleted=bond.is_deleted,
            created_at=bond.created_at,
            deleted_at=bond.deleted_at,
            current_event_seq=current_event_seq,
        )

    @staticmethod
    def _value_to_text(value: object) -> str:
        return TargetResolver.value_to_text(value)

    @staticmethod
    def _find_civilization_by_target(
        civilizations: list[ProjectedCivilization],
        target: str,
    ) -> ProjectedCivilization | None:
        return TargetResolver.find_civilization_by_target(civilizations, target)

    @staticmethod
    def _resolve_single_civilization_by_target(
        civilizations: list[ProjectedCivilization],
        target: str,
    ) -> ProjectedCivilization | None:
        return TargetResolver.resolve_single_civilization_by_target(civilizations, target)

    @staticmethod
    def _parse_uuid(value: object) -> UUID | None:
        return TargetResolver.parse_uuid(value)

    @staticmethod
    def _parse_expected_event_seq(value: object, *, field_name: str) -> int | None:
        return OccGuards.parse_expected_event_seq(value, field_name=field_name)

    @staticmethod
    def _projected_table_id_for_value(
        *,
        galaxy_id: UUID,
        value: Any,
        metadata: dict[str, Any],
    ) -> UUID:
        table_name = derive_table_name(value=value, metadata=metadata)
        return derive_table_id(galaxy_id=galaxy_id, table_name=table_name)

    @staticmethod
    def _find_civilizations_by_target(
        civilizations: list[ProjectedCivilization],
        target: str,
        condition: str | None,
    ) -> list[ProjectedCivilization]:
        return TargetResolver.find_civilizations_by_target(
            civilizations=civilizations,
            target=target,
            condition=condition,
        )

    async def _current_entity_event_seq(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
    ) -> int:
        return await self.occ_guards.current_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
        )

    async def _enforce_expected_entity_event_seq(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
        expected_event_seq: int | None,
        context: str,
    ) -> None:
        await self.occ_guards.enforce_expected_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
            expected_event_seq=expected_event_seq,
            context=context,
        )

    @staticmethod
    def _canonical_relation_pair(source_civilization_id: UUID, target_civilization_id: UUID) -> tuple[UUID, UUID]:
        return OccGuards.canonical_relation_pair(source_civilization_id, target_civilization_id)

    @staticmethod
    def _extract_contract_field(*, value: Any, metadata: dict[str, Any], field: str) -> Any:
        key = str(field).strip()
        if not key:
            return None
        if key == "value":
            return value
        return metadata.get(key)

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        return TableContractValidator._coerce_number(value)

    @staticmethod
    def _matches_expected_type(expected: str, value: Any) -> bool:
        return TableContractValidator._matches_expected_type(expected, value)

    @staticmethod
    def _normalize_unique_value(value: Any) -> Any:
        return TableContractValidator._normalize_unique_value(value)

    @staticmethod
    def _passes_validator(*, operator: str, field_value: Any, expected_value: Any) -> bool:
        return TableContractValidator._passes_validator(
            operator=operator,
            field_value=field_value,
            expected_value=expected_value,
        )

    async def _load_latest_table_contract(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        table_id: UUID,
        cache: dict[UUID, EffectiveTableContract | None],
    ) -> EffectiveTableContract | None:
        return await self.contract_validator.load_latest(
            session=session,
            galaxy_id=galaxy_id,
            table_id=table_id,
            cache=cache,
        )

    async def _validate_table_contract_write(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        civilization_id: UUID | None,
        value: Any,
        metadata: dict[str, Any],
        civilizations_by_id: dict[UUID, ProjectedCivilization],
        contract_cache: dict[UUID, EffectiveTableContract | None],
        execution_context: _TaskExecutionContext | None = None,
    ) -> None:
        await self.contract_validator.validate_write(
            session=session,
            galaxy_id=galaxy_id,
            civilization_id=civilization_id,
            value=value,
            metadata=metadata,
            civilizations_by_id=civilizations_by_id,
            cache=contract_cache,
        )

    def _normalize_runtime_tasks(self, *, tasks: list[InputTask]) -> list[AtomicTask]:
        normalized: list[AtomicTask] = []
        for task in tasks:
            if isinstance(task, AtomicTask):
                try:
                    normalized_task = intent_command_from_atomic_task(task)
                except IntentCommandValidationError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Invalid atomic task: {exc}",
                    ) from exc
                normalized.append(AtomicTask(action=normalized_task.action, params=dict(normalized_task.params)))
                continue
            if isinstance(task, PARSER_INTENT_TYPES):
                bridge_result = self.parser2_executor_bridge.to_atomic_tasks(IntentEnvelope(intents=[task]))
                if bridge_result.errors:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Invalid parser intent: {bridge_result.errors[0].message}",
                    )
                normalized.extend(bridge_result.tasks)
                continue
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unsupported task payload type: {type(task).__name__}",
            )
        return normalized

    async def _entity_event_seq_map(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_ids: set[UUID],
    ) -> dict[UUID, int]:
        if not entity_ids:
            return {}
        stmt = (
            select(Event.entity_id, func.max(Event.event_seq))
            .where(
                and_(
                    Event.user_id == user_id,
                    Event.galaxy_id == galaxy_id,
                    Event.entity_id.in_(entity_ids),
                )
            )
            .group_by(Event.entity_id)
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        rows = (await session.execute(stmt)).all()
        return {entity_id: int(max_seq or 0) for entity_id, max_seq in rows}

    async def _load_initial_context_state(
        self,
        *,
        session: AsyncSession,
        tasks: list[AtomicTask],
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> tuple[list[ProjectedCivilization], list[ProjectedBond]]:
        del tasks
        civilizations, bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            apply_calculations=False,
        )
        return civilizations, bonds

    async def _dispatch_task_family(self, *, task: AtomicTask, ctx: _TaskExecutionContext) -> bool:
        for handler in self.atomic_family_handlers:
            if await handler(task=task, ctx=ctx):
                return True
        return False

    async def _handle_ingest_update_family(self, *, task, ctx: _TaskExecutionContext) -> bool:
        return await handle_ingest_update_family(self, task=task, ctx=ctx)

    async def _handle_link_and_bond_mutation_family(self, *, task, ctx: _TaskExecutionContext) -> bool:
        return await handle_link_and_bond_mutation_family(self, task=task, ctx=ctx)

    async def _handle_extinguish_family(self, *, task, ctx: _TaskExecutionContext) -> bool:
        return await handle_extinguish_family(self, task=task, ctx=ctx)

    async def _handle_formula_guardian_select_family(self, *, task, ctx: _TaskExecutionContext) -> bool:
        return await handle_formula_guardian_select_family(self, task=task, ctx=ctx)

    async def _load_auto_semantic_rules_for_civilization(
        self,
        *,
        session,
        galaxy_id: UUID,
        civilization: ProjectedCivilization,
        contract_cache: dict[UUID, EffectiveTableContract | None],
    ) -> list[dict[str, Any]]:
        return await self.auto_semantics_service._load_auto_semantic_rules_for_civilization(
            session=session,
            galaxy_id=galaxy_id,
            civilization=civilization,
            contract_cache=contract_cache,
        )

    @staticmethod
    def _ensure_transaction_ready(*, session: AsyncSession, manage_transaction: bool) -> None:
        if not manage_transaction and not session.in_transaction():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="TaskExecutor requires an active transaction when manage_transaction=False",
            )

    @staticmethod
    @asynccontextmanager
    async def _no_transaction():
        yield

    def _resolve_transaction_context(self, *, session: AsyncSession, manage_transaction: bool):
        if manage_transaction:
            if session.in_transaction():
                return session.begin_nested()
            return session.begin()
        return self._no_transaction()

    @staticmethod
    async def _append_event_for_scope(
        *,
        session: AsyncSession,
        event_store: EventStoreService,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
        event_type: str,
        payload: dict,
    ) -> Event:
        return await event_store.append_event(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
            event_type=event_type,
            payload=payload,
        )

    def _build_execution_context(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        result: TaskExecutionResult,
        active_asteroids: list[ProjectedCivilization],
        active_bonds: list[ProjectedBond],
    ) -> _TaskExecutionContext:
        async def _uninitialized_append(*, entity_id: UUID, event_type: str, payload: dict) -> Event:
            del entity_id, event_type, payload
            raise RuntimeError("append callback not initialized")

        context = _TaskExecutionContext(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            result=result,
            context_civilization_ids=[],
            civilizations_by_id={a.id: a for a in active_asteroids},
            bonds_by_id={b.id: b for b in active_bonds},
            contract_cache={},
            appended_events=[],
            append_and_project_event=_uninitialized_append,
        )

        async def append_with_tracking(*, entity_id: UUID, event_type: str, payload: dict) -> Event:
            event = await self._append_event_for_scope(
                session=session,
                event_store=self.event_store,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                entity_id=entity_id,
                event_type=event_type,
                payload=payload,
            )
            context.appended_events.append(event)
            return event

        context.append_and_project_event = append_with_tracking
        return context

    async def _run_task_sequence(self, *, tasks: list[AtomicTask], ctx: _TaskExecutionContext) -> None:
        def _task_label(item: Any) -> str:
            kind = getattr(item, "kind", None)
            if isinstance(kind, str) and kind.strip():
                return kind
            action = getattr(item, "action", None)
            if isinstance(action, str) and action.strip():
                return action
            return "UNKNOWN"

        for task in tasks:
            if not await self._dispatch_task_family(task=task, ctx=ctx):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Unsupported task action: {_task_label(task)}",
                )

    async def _sync_read_model_if_needed(self, *, branch_id: UUID | None, ctx: _TaskExecutionContext) -> None:
        # Branch timelines are projected on read by event replay.
        # Main timeline keeps strong read-model consistency within the same transaction.
        if branch_id is None and ctx.appended_events:
            await self.read_model_projector.apply_events(session=ctx.session, events=ctx.appended_events)

    async def execute_tasks(
        self,
        session: AsyncSession,
        *,
        tasks: list[InputTask],
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        manage_transaction: bool = True,
    ) -> TaskExecutionResult:
        async with self._track_execution():
            self._ensure_transaction_ready(session=session, manage_transaction=manage_transaction)
            runtime_tasks = self._normalize_runtime_tasks(tasks=tasks)
            active_asteroids, active_bonds = await self._load_initial_context_state(
                session=session,
                tasks=runtime_tasks,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
            )

            result = TaskExecutionResult()
            transaction_ctx = self._resolve_transaction_context(
                session=session,
                manage_transaction=manage_transaction,
            )
            async with transaction_ctx:
                context = self._build_execution_context(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    branch_id=branch_id,
                    result=result,
                    active_asteroids=active_asteroids,
                    active_bonds=active_bonds,
                )
                await self._run_task_sequence(tasks=runtime_tasks, ctx=context)
                await self._sync_read_model_if_needed(branch_id=branch_id, ctx=context)

            return result
