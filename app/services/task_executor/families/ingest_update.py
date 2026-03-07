from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import HTTPException, status

from app.services.parser_service import AtomicTask
from app.services.universe_service import ProjectedAsteroid, derive_table_name, split_constellation_and_planet_name

if TYPE_CHECKING:
    from app.services.task_executor_service import TaskExecutorService, _TaskExecutionContext


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


async def handle_ingest_update_family(
    self: TaskExecutorService,
    *,
    task: AtomicTask,
    ctx: _TaskExecutionContext,
) -> bool:
    action = task.action.upper()
    if action == "INGEST":
        if "value" not in task.params:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="INGEST task requires value",
            )
        value = task.params["value"]
        raw_metadata = task.params.get("metadata")
        metadata = raw_metadata if isinstance(raw_metadata, dict) else {}
        requested_table_name = derive_table_name(value=value, metadata=metadata)
        requested_constellation_name, requested_planet_name = split_constellation_and_planet_name(requested_table_name)
        requested_table_id = self._projected_table_id_for_value(
            galaxy_id=ctx.galaxy_id,
            value=value,
            metadata=metadata,
        )
        active_table_ids_before = {
            self._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=asteroid.value,
                metadata=asteroid.metadata,
            )
            for asteroid in ctx.asteroids_by_id.values()
            if not asteroid.is_deleted
        }

        existing = next(
            (
                asteroid
                for asteroid in ctx.asteroids_by_id.values()
                if asteroid.value == value
                and not asteroid.is_deleted
                and self._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=asteroid.value,
                    metadata=asteroid.metadata,
                )
                == requested_table_id
            ),
            None,
        )
        if existing is None and ctx.preload_scope == "partial":
            candidate = await self._load_active_asteroid_by_value(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                value=value,
            )
            if candidate is not None:
                candidate_table_id = self._projected_table_id_for_value(
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
                    await self._hydrate_context_to_full_scope(ctx)
                    existing = next(
                        (
                            asteroid
                            for asteroid in ctx.asteroids_by_id.values()
                            if asteroid.value == value
                            and not asteroid.is_deleted
                            and self._projected_table_id_for_value(
                                galaxy_id=ctx.galaxy_id,
                                value=asteroid.value,
                                metadata=asteroid.metadata,
                            )
                            == requested_table_id
                        ),
                        None,
                    )

        if existing is None:
            await self._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                asteroid_id=None,
                value=value,
                metadata=dict(metadata),
                asteroids_by_id=ctx.asteroids_by_id,
                contract_cache=ctx.contract_cache,
                execution_context=ctx,
            )
            asteroid_id = uuid4()
            created_event = await ctx.append_and_project_event(
                entity_id=asteroid_id,
                event_type="ASTEROID_CREATED",
                payload={"value": value, "metadata": metadata},
            )
            asteroid = ProjectedAsteroid(
                id=asteroid_id,
                value=value,
                metadata=dict(metadata),
                is_deleted=False,
                created_at=created_event.timestamp,
                deleted_at=None,
                current_event_seq=int(created_event.event_seq),
            )
            ctx.asteroids_by_id[asteroid.id] = asteroid
            self._record_semantic_effect(
                ctx=ctx,
                code="MOON_UPSERTED",
                reason="Moon row was created from INGEST command.",
                task_action=action,
                rule_id="sem.upsert.ingest",
                inputs={"value": value, "table_name": requested_table_name},
                outputs={
                    "asteroid_id": asteroid.id,
                    "table_id": requested_table_id,
                    "constellation_name": requested_constellation_name,
                    "planet_name": requested_planet_name,
                    "created": True,
                },
            )
            if requested_table_id not in active_table_ids_before:
                self._record_semantic_effect(
                    ctx=ctx,
                    code="PLANET_INFERRED",
                    reason="A new planet bucket was inferred from moon table classification.",
                    task_action=action,
                    rule_id="sem.table.inferred",
                    inputs={"table_name": requested_table_name},
                    outputs={
                        "table_id": requested_table_id,
                        "constellation_name": requested_constellation_name,
                        "planet_name": requested_planet_name,
                    },
                )
        else:
            asteroid = existing
            previous_table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
            previous_table_id = self._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=asteroid.value,
                metadata=asteroid.metadata,
            )
            metadata_update = {k: v for k, v in metadata.items() if asteroid.metadata.get(k) != v}
            if metadata_update:
                next_metadata = {**asteroid.metadata, **metadata_update}
                await self._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    asteroid_id=asteroid.id,
                    value=asteroid.value,
                    metadata=next_metadata,
                    asteroids_by_id=ctx.asteroids_by_id,
                    contract_cache=ctx.contract_cache,
                    execution_context=ctx,
                )
                metadata_event = await ctx.append_and_project_event(
                    entity_id=asteroid.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": metadata_update},
                )
                asteroid.current_event_seq = int(metadata_event.event_seq)
                asteroid.metadata = next_metadata
                next_table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
                next_table_id = self._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=asteroid.value,
                    metadata=asteroid.metadata,
                )
                self._record_semantic_effect(
                    ctx=ctx,
                    code="MOON_UPSERTED",
                    reason="Existing moon metadata was synchronized from INGEST command.",
                    task_action=action,
                    rule_id="sem.upsert.ingest",
                    inputs={"asteroid_id": asteroid.id, "metadata_patch_keys": sorted(list(metadata_update.keys()))},
                    outputs={"asteroid_id": asteroid.id, "created": False, "table_id": next_table_id},
                )
                if previous_table_id != next_table_id:
                    next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
                    self._record_semantic_effect(
                        ctx=ctx,
                        code="MOON_RECLASSIFIED",
                        reason="Moon changed table classification after metadata update.",
                        task_action=action,
                        rule_id="sem.table.reclassify",
                        inputs={
                            "asteroid_id": asteroid.id,
                            "from_table_name": previous_table_name,
                            "to_table_name": next_table_name,
                        },
                        outputs={
                            "asteroid_id": asteroid.id,
                            "from_table_id": previous_table_id,
                            "to_table_id": next_table_id,
                            "constellation_name": next_constellation_name,
                            "planet_name": next_planet_name,
                        },
                    )
                    if next_table_id not in active_table_ids_before:
                        self._record_semantic_effect(
                            ctx=ctx,
                            code="PLANET_INFERRED",
                            reason="Reclassification produced a new inferred planet bucket.",
                            task_action=action,
                            rule_id="sem.table.inferred",
                            inputs={"table_name": next_table_name},
                            outputs={
                                "table_id": next_table_id,
                                "constellation_name": next_constellation_name,
                                "planet_name": next_planet_name,
                            },
                        )

        await self._apply_auto_semantics_for_asteroid(
            ctx=ctx,
            asteroid=asteroid,
            trigger_action=action,
        )
        ctx.context_asteroid_ids.append(asteroid.id)
        ctx.result.asteroids.append(asteroid)
        return True

    if action == "UPDATE_ASTEROID":
        asteroid_uuid = self._parse_uuid(task.params.get("asteroid_id"))
        if asteroid_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="UPDATE_ASTEROID requires valid asteroid_id",
            )

        asteroid = ctx.asteroids_by_id.get(asteroid_uuid)
        if asteroid is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target asteroid not found")
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=asteroid_uuid,
            expected_event_seq=expected_event_seq,
            context=f"UPDATE_ASTEROID {asteroid_uuid}",
        )

        has_change = False
        next_value = asteroid.value
        next_metadata = dict(asteroid.metadata)
        previous_table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
        previous_table_id = self._projected_table_id_for_value(
            galaxy_id=ctx.galaxy_id,
            value=asteroid.value,
            metadata=asteroid.metadata,
        )
        active_table_ids_before = {
            self._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=item.value,
                metadata=item.metadata,
            )
            for item in ctx.asteroids_by_id.values()
            if not item.is_deleted
        }
        if "value" in task.params:
            next_value = task.params.get("value")
            if asteroid.value != next_value:
                has_change = True

        raw_metadata = task.params.get("metadata")
        if isinstance(raw_metadata, dict) and raw_metadata:
            metadata_update = {k: v for k, v in raw_metadata.items() if asteroid.metadata.get(k) != v}
            if metadata_update:
                next_metadata = {**next_metadata, **metadata_update}
                has_change = True
        else:
            metadata_update = {}

        metadata_remove = _normalize_metadata_remove(task.params.get("metadata_remove"))
        removed_metadata_keys: list[str] = []
        if metadata_remove:
            for key in metadata_remove:
                if key not in next_metadata:
                    continue
                del next_metadata[key]
                removed_metadata_keys.append(key)
            if removed_metadata_keys:
                has_change = True

        if not has_change:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No effective update for asteroid",
            )

        await self._validate_table_contract_write(
            session=ctx.session,
            galaxy_id=ctx.galaxy_id,
            asteroid_id=asteroid.id,
            value=next_value,
            metadata=next_metadata,
            asteroids_by_id=ctx.asteroids_by_id,
            contract_cache=ctx.contract_cache,
            execution_context=ctx,
        )

        if asteroid.value != next_value:
            value_event = await ctx.append_and_project_event(
                entity_id=asteroid.id,
                event_type="ASTEROID_VALUE_UPDATED",
                payload={"value": next_value},
            )
            asteroid.current_event_seq = int(value_event.event_seq)
            asteroid.value = next_value

        if asteroid.metadata != next_metadata:
            metadata_update = {
                key: value for key, value in next_metadata.items() if asteroid.metadata.get(key) != value
            }
            if metadata_update or removed_metadata_keys:
                metadata_payload: dict[str, object] = {"metadata": metadata_update}
                if removed_metadata_keys:
                    metadata_payload["metadata_remove"] = removed_metadata_keys
                metadata_event = await ctx.append_and_project_event(
                    entity_id=asteroid.id,
                    event_type="METADATA_UPDATED",
                    payload=metadata_payload,
                )
                asteroid.current_event_seq = int(metadata_event.event_seq)
                asteroid.metadata = next_metadata

        next_table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
        next_table_id = self._projected_table_id_for_value(
            galaxy_id=ctx.galaxy_id,
            value=asteroid.value,
            metadata=asteroid.metadata,
        )
        self._record_semantic_effect(
            ctx=ctx,
            code="MOON_UPDATED",
            reason="Moon value or metadata was updated.",
            task_action=action,
            rule_id="sem.update.asteroid",
            inputs={"asteroid_id": asteroid.id},
            outputs={"asteroid_id": asteroid.id, "table_id": next_table_id},
        )
        if previous_table_id != next_table_id:
            next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
            self._record_semantic_effect(
                ctx=ctx,
                code="MOON_RECLASSIFIED",
                reason="Moon moved to another planet/table after update.",
                task_action=action,
                rule_id="sem.table.reclassify",
                inputs={
                    "asteroid_id": asteroid.id,
                    "from_table_name": previous_table_name,
                    "to_table_name": next_table_name,
                },
                outputs={
                    "asteroid_id": asteroid.id,
                    "from_table_id": previous_table_id,
                    "to_table_id": next_table_id,
                    "constellation_name": next_constellation_name,
                    "planet_name": next_planet_name,
                },
            )
            if next_table_id not in active_table_ids_before:
                self._record_semantic_effect(
                    ctx=ctx,
                    code="PLANET_INFERRED",
                    reason="Update produced a new inferred planet bucket.",
                    task_action=action,
                    rule_id="sem.table.inferred",
                    inputs={"table_name": next_table_name},
                    outputs={
                        "table_id": next_table_id,
                        "constellation_name": next_constellation_name,
                        "planet_name": next_planet_name,
                    },
                )

        await self._apply_auto_semantics_for_asteroid(
            ctx=ctx,
            asteroid=asteroid,
            trigger_action=action,
        )
        ctx.result.asteroids.append(asteroid)
        return True

    return False
