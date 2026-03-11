from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.parser2.intents import AssignAttributeIntent, Intent, UpsertNodeIntent
from app.services.universe_service import ProjectedAsteroid, derive_table_name, split_constellation_and_planet_name

if TYPE_CHECKING:
    from app.core.task_executor.service import TaskExecutorService, _TaskExecutionContext


def _normalize_metadata_remove(raw_value: object) -> list[str]:
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="`metadata_remove` must be a list of keys",
        )
    keys: list[str] = []
    seen: set[str] = set()
    for item in raw_value:
        key = str(item or "").strip()
        if not key or key in seen:
            continue
        keys.append(key)
        seen.add(key)
    return keys


class IngestUpdateHandler:
    def __init__(self, service: TaskExecutorService):
        self.service = service

    async def handle(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        if isinstance(task, UpsertNodeIntent):
            value = task.node.value
            metadata = task.metadata
            requested_table_name = derive_table_name(value=value, metadata=metadata)
            requested_constellation_name, requested_planet_name = split_constellation_and_planet_name(
                requested_table_name
            )
            requested_table_id = self.service._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=value,
                metadata=metadata,
            )
            active_table_ids_before = {
                self.service._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=civilization.value,
                    metadata=civilization.metadata,
                )
                for civilization in ctx.asteroids_by_id.values()
                if not civilization.is_deleted
            }

            existing = next(
                (
                    civilization
                    for civilization in ctx.asteroids_by_id.values()
                    if civilization.value == value
                    and not civilization.is_deleted
                    and self.service._projected_table_id_for_value(
                        galaxy_id=ctx.galaxy_id,
                        value=civilization.value,
                        metadata=civilization.metadata,
                    )
                    == requested_table_id
                ),
                None,
            )
            if existing is None and ctx.preload_scope == "partial":
                candidate = await self.service._load_active_asteroid_by_value(
                    session=ctx.session,
                    user_id=ctx.user_id,
                    galaxy_id=ctx.galaxy_id,
                    value=value,
                )
                if candidate is not None:
                    candidate_table_id = self.service._projected_table_id_for_value(
                        galaxy_id=ctx.galaxy_id,
                        value=candidate.value,
                        metadata=candidate.metadata,
                    )
                    if candidate_table_id == requested_table_id:
                        existing = candidate
                        ctx.asteroids_by_id[existing.id] = existing
                    else:
                        # The fast value lookup found a row in a different table.
                        # Hydrate full scope and retry table-aware match before creating a new row.
                        await self.service._hydrate_context_to_full_scope(ctx)
                        existing = next(
                            (
                                civilization
                                for civilization in ctx.asteroids_by_id.values()
                                if civilization.value == value
                                and not civilization.is_deleted
                                and self.service._projected_table_id_for_value(
                                    galaxy_id=ctx.galaxy_id,
                                    value=civilization.value,
                                    metadata=civilization.metadata,
                                )
                                == requested_table_id
                            ),
                            None,
                        )

            if existing is None:
                await self.service._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    civilization_id=None,
                    value=value,
                    metadata=dict(metadata),
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                    execution_context=ctx,
                )
                civilization_id = uuid4()
                created_event = await ctx.append_and_project_event(
                    entity_id=civilization_id,
                    event_type="ASTEROID_CREATED",
                    payload={"value": value, "metadata": metadata},
                )
                civilization = ProjectedAsteroid(
                    id=civilization_id,
                    value=value,
                    metadata=dict(metadata),
                    is_deleted=False,
                    created_at=created_event.timestamp,
                    deleted_at=None,
                    current_event_seq=int(created_event.event_seq),
                )
                ctx.asteroids_by_id[civilization.id] = civilization
                self.service._record_semantic_effect(
                    ctx=ctx,
                    code="MOON_UPSERTED",
                    reason="Moon row was created from INGEST command.",
                    task_action="INGEST",
                    rule_id="sem.upsert.ingest",
                    inputs={"value": value, "table_name": requested_table_name},
                    outputs={
                        "civilization_id": civilization.id,
                        "table_id": requested_table_id,
                        "constellation_name": requested_constellation_name,
                        "planet_name": requested_planet_name,
                        "created": True,
                    },
                )
                if requested_table_id not in active_table_ids_before:
                    self.service._record_semantic_effect(
                        ctx=ctx,
                        code="PLANET_INFERRED",
                        reason="A new planet bucket was inferred from moon table classification.",
                        task_action="INGEST",
                        rule_id="sem.table.inferred",
                        inputs={"table_name": requested_table_name},
                        outputs={
                            "table_id": requested_table_id,
                            "constellation_name": requested_constellation_name,
                            "planet_name": requested_planet_name,
                        },
                    )
            else:
                civilization = existing
                previous_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
                previous_table_id = self.service._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=civilization.value,
                    metadata=civilization.metadata,
                )
                metadata_update = {k: v for k, v in metadata.items() if civilization.metadata.get(k) != v}
                if metadata_update:
                    next_metadata = {**civilization.metadata, **metadata_update}
                    await self.service._validate_table_contract_write(
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
                        payload={"metadata": metadata_update},
                    )
                    civilization.current_event_seq = int(metadata_event.event_seq)
                    civilization.metadata = next_metadata
                    next_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
                    next_table_id = self.service._projected_table_id_for_value(
                        galaxy_id=ctx.galaxy_id,
                        value=civilization.value,
                        metadata=civilization.metadata,
                    )
                    self.service._record_semantic_effect(
                        ctx=ctx,
                        code="MOON_UPSERTED",
                        reason="Existing moon metadata was synchronized from INGEST command.",
                        task_action="INGEST",
                        rule_id="sem.upsert.ingest",
                        inputs={
                            "civilization_id": civilization.id,
                            "metadata_patch_keys": sorted(list(metadata_update.keys())),
                        },
                        outputs={"civilization_id": civilization.id, "created": False, "table_id": next_table_id},
                    )
                    if previous_table_id != next_table_id:
                        next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
                        self.service._record_semantic_effect(
                            ctx=ctx,
                            code="MOON_RECLASSIFIED",
                            reason="Moon changed table classification after metadata update.",
                            task_action="INGEST",
                            rule_id="sem.table.reclassify",
                            inputs={
                                "civilization_id": civilization.id,
                                "from_table_name": previous_table_name,
                                "to_table_name": next_table_name,
                            },
                            outputs={
                                "civilization_id": civilization.id,
                                "from_table_id": previous_table_id,
                                "to_table_id": next_table_id,
                                "constellation_name": next_constellation_name,
                                "planet_name": next_planet_name,
                            },
                        )
                        if next_table_id not in active_table_ids_before:
                            self.service._record_semantic_effect(
                                ctx=ctx,
                                code="PLANET_INFERRED",
                                reason="Reclassification produced a new inferred planet bucket.",
                                task_action="INGEST",
                                rule_id="sem.table.inferred",
                                inputs={"table_name": next_table_name},
                                outputs={
                                    "table_id": next_table_id,
                                    "constellation_name": next_constellation_name,
                                    "planet_name": next_planet_name,
                                },
                            )

            await self.service._apply_auto_semantics_for_asteroid(
                ctx=ctx,
                civilization=civilization,
                trigger_action="INGEST",
            )
            ctx.context_civilization_ids.append(civilization.id)
            ctx.result.civilizations.append(civilization)
            return True

        if isinstance(task, AssignAttributeIntent):
            civilization = self.service._resolve_single_asteroid_by_target(
                civilizations=list(ctx.asteroids_by_id.values()), target=task.target.value
            )
            if civilization is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target civilization not found")

            asteroid_uuid = civilization.id
            expected_event_seq = self.service._parse_expected_event_seq(
                task.expected_event_seq,
                field_name="expected_event_seq",
            )

            await self.service._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=asteroid_uuid,
                expected_event_seq=expected_event_seq,
                context=f"UPDATE_ASTEROID {asteroid_uuid}",
            )

            has_change = False
            next_value = civilization.value
            next_metadata = dict(civilization.metadata)
            previous_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
            previous_table_id = self.service._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=civilization.value,
                metadata=civilization.metadata,
            )
            active_table_ids_before = {
                self.service._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=item.value,
                    metadata=item.metadata,
                )
                for item in ctx.asteroids_by_id.values()
                if not item.is_deleted
            }

            metadata_update = {}
            if task.field == "value":
                if civilization.value != task.value:
                    next_value = task.value
                    has_change = True
            else:
                if next_metadata.get(task.field) != task.value:
                    metadata_update = {task.field: task.value}
                    next_metadata[task.field] = task.value
                    has_change = True

            removed_metadata_keys: list[str] = []

            if not has_change:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="No effective update for civilization",
                )

            await self.service._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                civilization_id=civilization.id,
                value=next_value,
                metadata=next_metadata,
                asteroids_by_id=ctx.asteroids_by_id,
                contract_cache=ctx.contract_cache,
                execution_context=ctx,
            )

            if civilization.value != next_value:
                value_event = await ctx.append_and_project_event(
                    entity_id=civilization.id,
                    event_type="ASTEROID_VALUE_UPDATED",
                    payload={"value": next_value},
                )
                civilization.current_event_seq = int(value_event.event_seq)
                civilization.value = next_value

            if civilization.metadata != next_metadata:
                metadata_payload: dict[str, object] = {"metadata": metadata_update}
                if removed_metadata_keys:
                    metadata_payload["metadata_remove"] = removed_metadata_keys
                metadata_event = await ctx.append_and_project_event(
                    entity_id=civilization.id,
                    event_type="METADATA_UPDATED",
                    payload=metadata_payload,
                )
                civilization.current_event_seq = int(metadata_event.event_seq)
                civilization.metadata = next_metadata

            next_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
            next_table_id = self.service._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=civilization.value,
                metadata=civilization.metadata,
            )
            self.service._record_semantic_effect(
                ctx=ctx,
                code="MOON_UPDATED",
                reason="Moon value or metadata was updated.",
                task_action="UPDATE_ASTEROID",
                rule_id="sem.update.civilization",
                inputs={"civilization_id": civilization.id},
                outputs={"civilization_id": civilization.id, "table_id": next_table_id},
            )
            if previous_table_id != next_table_id:
                next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
                self.service._record_semantic_effect(
                    ctx=ctx,
                    code="MOON_RECLASSIFIED",
                    reason="Moon moved to another planet/table after update.",
                    task_action="UPDATE_ASTEROID",
                    rule_id="sem.table.reclassify",
                    inputs={
                        "civilization_id": civilization.id,
                        "from_table_name": previous_table_name,
                        "to_table_name": next_table_name,
                    },
                    outputs={
                        "civilization_id": civilization.id,
                        "from_table_id": previous_table_id,
                        "to_table_id": next_table_id,
                        "constellation_name": next_constellation_name,
                        "planet_name": next_planet_name,
                    },
                )
                if next_table_id not in active_table_ids_before:
                    self.service._record_semantic_effect(
                        ctx=ctx,
                        code="PLANET_INFERRED",
                        reason="Update produced a new inferred planet bucket.",
                        task_action="UPDATE_ASTEROID",
                        rule_id="sem.table.inferred",
                        inputs={"table_name": next_table_name},
                        outputs={
                            "table_id": next_table_id,
                            "constellation_name": next_constellation_name,
                            "planet_name": next_planet_name,
                        },
                    )

            await self.service._apply_auto_semantics_for_asteroid(
                ctx=ctx,
                civilization=civilization,
                trigger_action="UPDATE_ASTEROID",
            )
            ctx.result.civilizations.append(civilization)
            return True

        return False
