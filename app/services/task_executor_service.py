from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, cast, func, literal, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bond, CivilizationRM, Event
from app.services.bond_semantics import normalize_bond_type
from app.services.event_store_service import EventStoreService
from app.services.parser2.intents import (
    AddGuardianIntent,
    AssignAttributeIntent,
    BulkIntent,
    CreateLinkIntent,
    ExtinguishNodeIntent,
    Intent,
    NodeSelectorType,
    SelectNodesIntent,
    SetFormulaIntent,
    UpsertNodeIntent,
)
from app.services.read_model_projector import ReadModelProjector
from app.services.table_contract_effective import EffectiveTableContract
from app.services.task_executor.contract_validation import TableContractValidator
from app.services.task_executor.families import (
    handle_extinguish_family,
    handle_formula_guardian_select_family,
    handle_ingest_update_family,
    handle_link_and_bond_mutation_family,
)
from app.services.task_executor.occ_guards import OccGuards
from app.services.task_executor.target_resolution import TargetResolver
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    UniverseService,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)


@dataclass
class TaskExecutionResult:
    civilizations: list[ProjectedAsteroid] = field(default_factory=list)
    bonds: list[ProjectedBond] = field(default_factory=list)
    selected_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_civilization_ids: list[UUID] = field(default_factory=list)
    extinguished_bond_ids: list[UUID] = field(default_factory=list)
    semantic_effects: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class _TaskExecutionContext:
    session: AsyncSession
    user_id: UUID
    galaxy_id: UUID
    branch_id: UUID | None
    result: TaskExecutionResult
    context_civilization_ids: list[UUID]
    asteroids_by_id: dict[UUID, ProjectedAsteroid]
    bonds_by_id: dict[UUID, ProjectedBond]
    contract_cache: dict[UUID, EffectiveTableContract | None]
    appended_events: list[Event]
    append_and_project_event: Callable[..., Awaitable[Event]]
    preload_scope: str = "full"


@dataclass(frozen=True)
class _PreloadPlan:
    scope: str
    civilization_ids: frozenset[UUID] = frozenset()
    bond_ids: frozenset[UUID] = frozenset()
    include_connected_bonds: bool = False


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

    @staticmethod
    def _normalize_semantic_token(value: Any) -> str:
        return str(value or "").strip().casefold()

    @classmethod
    def _semantic_rule_matches_value(cls, *, rule: dict[str, Any], value: Any) -> bool:
        normalized = cls._normalize_semantic_token(value)
        if not normalized:
            return False
        raw_equals = rule.get("equals")
        if raw_equals is not None:
            return normalized == cls._normalize_semantic_token(raw_equals)
        raw_values = rule.get("in") if isinstance(rule.get("in"), list) else rule.get("match_values")
        if isinstance(raw_values, list):
            candidates = {cls._normalize_semantic_token(item) for item in raw_values}
            return normalized in candidates
        return False

    @staticmethod
    def _semantic_rule_target_table_name(rule: dict[str, Any]) -> str:
        direct = str(rule.get("target_table") or "").strip()
        if direct:
            return direct
        constellation = str(rule.get("target_constellation") or "").strip()
        planet = str(rule.get("target_planet") or "").strip()
        if constellation and planet:
            return f"{constellation} > {planet}"
        if planet:
            return planet
        return ""

    async def _load_auto_semantic_rules_for_asteroid(
        self,
        *,
        session: AsyncSession,
        galaxy_id: UUID,
        civilization: ProjectedAsteroid,
        contract_cache: dict[UUID, EffectiveTableContract | None],
    ) -> list[dict[str, Any]]:
        if session is None:
            return []
        table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
        table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        contract = await self._load_latest_table_contract(
            session=session,
            galaxy_id=galaxy_id,
            table_id=table_id,
            cache=contract_cache,
        )
        if contract is None:
            return []
        raw_rules: list[Any] = []
        physics_rulebook = contract.physics_rulebook if isinstance(contract.physics_rulebook, dict) else {}
        defaults = physics_rulebook.get("defaults") if isinstance(physics_rulebook, dict) else {}
        if isinstance(defaults, dict):
            candidate = defaults.get("auto_semantics")
            if isinstance(candidate, list):
                raw_rules = candidate
        if raw_rules:
            return [rule for rule in raw_rules if isinstance(rule, dict)]

        # Backward-compatible fallback for pre-registry storage in validators.
        validators = contract.validators if isinstance(contract.validators, list) else []
        extracted: list[dict[str, Any]] = []
        for item in validators:
            if not isinstance(item, dict):
                continue
            embedded_rule = item.get("rule")
            if isinstance(embedded_rule, dict) and str(item.get("kind") or "").strip().lower() in {
                "auto_semantic",
                "auto_semantics",
            }:
                extracted.append(embedded_rule)
                continue
            kind = str(item.get("kind") or "").strip().lower()
            if kind == "bucket_by_metadata_value":
                extracted.append(item)
        return extracted

    async def _apply_auto_semantics_for_asteroid(
        self,
        *,
        ctx: _TaskExecutionContext,
        civilization: ProjectedAsteroid,
        trigger_action: str,
    ) -> None:
        # Stage 1 automation: contract-driven table bucketing.
        # Rules are persisted in table_contract.physics_rulebook.defaults.auto_semantics
        # and also exposed via API schema_registry.auto_semantics.
        # Example rule:
        # {
        #   "id": "role-employee-bucket",
        #   "kind": "bucket_by_metadata_value",
        #   "field": "role",
        #   "in": ["employee", "zamestnanec"],
        #   "target_constellation": "HR",
        #   "target_planet": "Zamestnanci"
        # }
        guard = 0
        while guard < 4:
            guard += 1
            rules = await self._load_auto_semantic_rules_for_asteroid(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                civilization=civilization,
                contract_cache=ctx.contract_cache,
            )
            if not rules:
                return

            before_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
            before_table_id = derive_table_id(galaxy_id=ctx.galaxy_id, table_name=before_table_name)
            active_table_ids_before = {
                self._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=item.value,
                    metadata=item.metadata,
                )
                for item in ctx.asteroids_by_id.values()
                if not item.is_deleted
            }

            changed = False
            for rule in rules:
                if not bool(rule.get("enabled", True)):
                    continue
                if str(rule.get("kind") or "").strip().lower() != "bucket_by_metadata_value":
                    continue
                field = str(rule.get("field") or "").strip()
                if not field:
                    continue
                if field == "value":
                    field_value = civilization.value
                else:
                    field_value = civilization.metadata.get(field)
                if not self._semantic_rule_matches_value(rule=rule, value=field_value):
                    continue

                target_table_name = self._semantic_rule_target_table_name(rule)
                if not target_table_name:
                    continue
                if self._normalize_semantic_token(target_table_name) == self._normalize_semantic_token(
                    before_table_name
                ):
                    continue

                metadata_patch = {}
                if civilization.metadata.get("table") != target_table_name:
                    metadata_patch["table"] = target_table_name
                if civilization.metadata.get("table_name") != target_table_name:
                    metadata_patch["table_name"] = target_table_name
                if not metadata_patch:
                    continue

                next_metadata = {**civilization.metadata, **metadata_patch}
                await self._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    civilization_id=civilization.id,
                    value=civilization.value,
                    metadata=next_metadata,
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                    execution_context=ctx,
                )
                metadata_event = await ctx.append_and_project_event(
                    entity_id=civilization.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": metadata_patch},
                )
                civilization.current_event_seq = int(metadata_event.event_seq)
                civilization.metadata = next_metadata
                after_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
                after_table_id = derive_table_id(galaxy_id=ctx.galaxy_id, table_name=after_table_name)
                after_constellation_name, after_planet_name = split_constellation_and_planet_name(after_table_name)
                self._record_semantic_effect(
                    ctx=ctx,
                    code="MOON_RECLASSIFIED",
                    reason="Auto semantic rule moved moon to another planet bucket.",
                    task_action=trigger_action,
                    rule_id=str(rule.get("id") or "sem.auto.bucket_by_metadata_value"),
                    inputs={
                        "civilization_id": civilization.id,
                        "field": field,
                        "value": field_value,
                        "from_table_name": before_table_name,
                        "to_table_name": after_table_name,
                    },
                    outputs={
                        "civilization_id": civilization.id,
                        "from_table_id": before_table_id,
                        "to_table_id": after_table_id,
                        "constellation_name": after_constellation_name,
                        "planet_name": after_planet_name,
                    },
                )
                if after_table_id not in active_table_ids_before:
                    self._record_semantic_effect(
                        ctx=ctx,
                        code="PLANET_INFERRED",
                        reason="Auto semantic bucketing inferred a new planet.",
                        task_action=trigger_action,
                        rule_id=str(rule.get("id") or "sem.auto.bucket_by_metadata_value"),
                        inputs={"table_name": after_table_name},
                        outputs={
                            "table_id": after_table_id,
                            "constellation_name": after_constellation_name,
                            "planet_name": after_planet_name,
                        },
                    )
                changed = True
                break

            if not changed:
                return

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
    def _find_asteroid_by_target(
        civilizations: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        return TargetResolver.find_asteroid_by_target(civilizations, target)

    @staticmethod
    def _resolve_single_asteroid_by_target(
        civilizations: list[ProjectedAsteroid],
        target: str,
    ) -> ProjectedAsteroid | None:
        return TargetResolver.resolve_single_asteroid_by_target(civilizations, target)

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
    def _find_asteroids_by_target(
        civilizations: list[ProjectedAsteroid],
        target: str,
        condition: str | None,
    ) -> list[ProjectedAsteroid]:
        return TargetResolver.find_asteroids_by_target(
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
        asteroids_by_id: dict[UUID, ProjectedAsteroid],
        contract_cache: dict[UUID, EffectiveTableContract | None],
        execution_context: _TaskExecutionContext | None = None,
    ) -> None:
        await self.contract_validator.validate_write(
            session=session,
            galaxy_id=galaxy_id,
            civilization_id=civilization_id,
            value=value,
            metadata=metadata,
            asteroids_by_id=asteroids_by_id,
            cache=contract_cache,
        )

    @staticmethod
    def _full_preload_plan() -> _PreloadPlan:
        return _PreloadPlan(scope="full")

    def _build_preload_plan(self, *, tasks: list[Intent], branch_id: UUID | None) -> _PreloadPlan:
        # Branch timelines are reconstructed from events on read, so partial read-model preload is unsafe there.
        if branch_id is not None:
            return self._full_preload_plan()

        civilization_ids: set[UUID] = set()
        bond_ids: set[UUID] = set()
        include_connected_bonds = False

        intents_to_process: list[Intent] = []
        for task in tasks:
            if isinstance(task, BulkIntent):
                intents_to_process.extend(task.intents)
            else:
                intents_to_process.append(task)

        for intent in intents_to_process:
            if isinstance(intent, UpsertNodeIntent):
                # Upsert by name is fuzzy, but by ID is specific.
                # However, INGEST logic can start from an empty scope, so we don't need to preload.
                continue

            if isinstance(intent, CreateLinkIntent):
                if intent.source.selector_type != NodeSelectorType.ID or intent.target.selector_type != NodeSelectorType.ID:
                    return self._full_preload_plan()
                source_uuid = self._parse_uuid(intent.source.value)
                target_uuid = self._parse_uuid(intent.target.value)
                if source_uuid is None or target_uuid is None:
                    return self._full_preload_plan()
                civilization_ids.add(source_uuid)
                civilization_ids.add(target_uuid)
                continue

            if isinstance(intent, AssignAttributeIntent):
                if intent.target.selector_type != NodeSelectorType.ID:
                    return self._full_preload_plan()
                asteroid_uuid = self._parse_uuid(intent.target.value)
                if asteroid_uuid is None:
                    return self._full_preload_plan()
                civilization_ids.add(asteroid_uuid)
                continue

            if isinstance(intent, (SetFormulaIntent, AddGuardianIntent)):
                # If target is not a UUID, it's a fuzzy name-based target.
                target_uuid = self._parse_uuid(intent.target)
                if target_uuid is None:
                    return self._full_preload_plan()
                civilization_ids.add(target_uuid)
                continue

            if isinstance(intent, ExtinguishNodeIntent):
                if intent.target.selector_type != NodeSelectorType.ID:
                    return self._full_preload_plan()
                asteroid_uuid = self._parse_uuid(intent.target.value)
                if asteroid_uuid is None:
                    return self._full_preload_plan()
                civilization_ids.add(asteroid_uuid)
                include_connected_bonds = True
                continue

            # Any other intent, especially SELECT, requires full context.
            return self._full_preload_plan()

        return _PreloadPlan(
            scope="partial",
            civilization_ids=frozenset(civilization_ids),
            bond_ids=frozenset(bond_ids),
            include_connected_bonds=include_connected_bonds,
        )

    async def _load_active_asteroid_by_value(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        value: Any,
    ) -> ProjectedAsteroid | None:
        try:
            value_json = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except TypeError:
            # Non-JSON-serializable value cannot be matched safely via DB equality lookup.
            return None

        row = (
            (
                await session.execute(
                    select(CivilizationRM).where(
                        and_(
                            CivilizationRM.user_id == user_id,
                            CivilizationRM.galaxy_id == galaxy_id,
                            CivilizationRM.is_deleted.is_(False),
                            CivilizationRM.value == cast(literal(value_json), JSONB),
                        )
                    )
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            return None

        event_seq_map = await self._entity_event_seq_map(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_ids={row.id},
        )
        return ProjectedAsteroid(
            id=row.id,
            value=row.value,
            metadata=row.metadata_ if isinstance(row.metadata_, dict) else {},
            is_deleted=row.is_deleted,
            created_at=row.created_at,
            deleted_at=row.deleted_at,
            current_event_seq=event_seq_map.get(row.id, 0),
        )

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
        tasks: list[Intent],
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> tuple[list[ProjectedAsteroid], list[ProjectedBond], str]:
        civilizations, bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            apply_calculations=False,
        )
        return civilizations, bonds, "full"

    async def _handle_ingest_update_family(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        return await handle_ingest_update_family(self, task=task, ctx=ctx)

    async def _handle_link_and_bond_mutation_family(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        return await handle_link_and_bond_mutation_family(self, task=task, ctx=ctx)

    async def _handle_extinguish_family(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        return await handle_extinguish_family(self, task=task, ctx=ctx)

    async def _handle_formula_guardian_select_family(
        self,
        *,
        task: Intent,
        ctx: _TaskExecutionContext,
    ) -> bool:
        return await handle_formula_guardian_select_family(self, task=task, ctx=ctx)

    async def _dispatch_task_family(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        if isinstance(task, (UpsertNodeIntent, AssignAttributeIntent)):
            return await self._handle_ingest_update_family(task=task, ctx=ctx)
        if isinstance(task, CreateLinkIntent):
            return await self._handle_link_and_bond_mutation_family(task=task, ctx=ctx)
        if isinstance(task, ExtinguishNodeIntent):
            return await self._handle_extinguish_family(task=task, ctx=ctx)
        if isinstance(task, (SetFormulaIntent, AddGuardianIntent, SelectNodesIntent)):
            return await self._handle_formula_guardian_select_family(task=task, ctx=ctx)
        return False

    async def execute_tasks(
        self,
        session: AsyncSession,
        *,
        tasks: list[Intent],
        user_id: UUID,
        galaxy_id: UUID = DEFAULT_GALAXY_ID,
        branch_id: UUID | None = None,
        manage_transaction: bool = True,
    ) -> TaskExecutionResult:
        active_asteroids, active_bonds, preload_scope = await self._load_initial_context_state(
            session=session,
            tasks=tasks,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
        if not manage_transaction and not session.in_transaction():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="TaskExecutor requires an active transaction when manage_transaction=False",
            )

        @asynccontextmanager
        async def _no_transaction():
            yield

        async def append_and_project_event(
            *,
            entity_id: UUID,
            event_type: str,
            payload: dict,
        ) -> Event:
            event = await self.event_store.append_event(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                entity_id=entity_id,
                event_type=event_type,
                payload=payload,
            )
            return event

        result = TaskExecutionResult()
        transaction_ctx = (
            (session.begin_nested() if session.in_transaction() else session.begin())
            if manage_transaction
            else _no_transaction()
        )
        async with transaction_ctx:
            context = _TaskExecutionContext(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                result=result,
                context_civilization_ids=[],
                asteroids_by_id={a.id: a for a in active_asteroids},
                bonds_by_id={b.id: b for b in active_bonds},
                contract_cache={},
                appended_events=[],
                append_and_project_event=append_and_project_event,
                preload_scope=preload_scope,
            )

            async def append_with_tracking(*, entity_id: UUID, event_type: str, payload: dict) -> Event:
                event = await append_and_project_event(
                    entity_id=entity_id,
                    event_type=event_type,
                    payload=payload,
                )
                context.appended_events.append(event)
                return event

            context.append_and_project_event = append_with_tracking
            for task in tasks:
                if isinstance(task, BulkIntent):
                    for sub_intent in task.intents:
                        if not await self._dispatch_task_family(task=sub_intent, ctx=context):
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                                detail=f"Unsupported task action: {sub_intent.kind}",
                            )
                else:
                    if not await self._dispatch_task_family(task=task, ctx=context):
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail=f"Unsupported task action: {task.kind}",
                        )

            # Branch timelines are projected on read by event replay.
            # Main timeline keeps strong read-model consistency within the same transaction.
            if branch_id is None and context.appended_events:
                await self.read_model_projector.apply_events(session=session, events=context.appended_events)

        return result
