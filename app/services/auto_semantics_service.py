from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from app.services.universe_service import (
    ProjectedAsteroid,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.services.table_contract_effective import EffectiveTableContract
    from app.services.task_executor_service import (
        TaskExecutorService,
        _TaskExecutionContext,
    )


class AutoSemanticsService:
    def __init__(self, task_executor: TaskExecutorService):
        self.executor = task_executor

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
        contract = await self.executor._load_latest_table_contract(
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

    async def apply_auto_semantics_for_asteroid(
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
                self.executor._projected_table_id_for_value(
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
                await self.executor._validate_table_contract_write(
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
                self.executor._record_semantic_effect(
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
                    self.executor._record_semantic_effect(
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
