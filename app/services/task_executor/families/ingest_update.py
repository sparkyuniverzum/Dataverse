from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import HTTPException, status

from app.services.parser_types import AtomicTask
from app.services.universe_service import ProjectedCivilization, derive_table_name, split_constellation_and_planet_name

if TYPE_CHECKING:
    from app.services.task_executor.service import TaskExecutorService, _TaskExecutionContext


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


def _normalize_lifecycle_state(civilization: ProjectedCivilization) -> str:
    metadata = civilization.metadata if isinstance(civilization.metadata, dict) else {}
    raw = metadata.get("state", metadata.get("status"))
    state = str(raw or "").strip().upper()
    if not state:
        state = "ARCHIVED" if civilization.is_deleted else "ACTIVE"
    return state


def _can_transition_lifecycle(from_state: str, to_state: str) -> bool:
    source = str(from_state or "").strip().upper() or "UNKNOWN"
    target = str(to_state or "").strip().upper()
    if not target or source == target:
        return False
    allowed = {
        "DRAFT": {"ACTIVE", "ARCHIVED"},
        "ACTIVE": {"ARCHIVED"},
        "ANOMALY": {"ACTIVE", "ARCHIVED"},
        "UNKNOWN": {"ACTIVE", "ARCHIVED"},
        "ARCHIVED": set(),
    }
    return target in allowed.get(source, set())


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
                value=civilization.value,
                metadata=civilization.metadata,
            )
            for civilization in ctx.civilizations_by_id.values()
            if not civilization.is_deleted
        }

        existing = next(
            (
                civilization
                for civilization in ctx.civilizations_by_id.values()
                if civilization.value == value
                and not civilization.is_deleted
                and self._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=civilization.value,
                    metadata=civilization.metadata,
                )
                == requested_table_id
            ),
            None,
        )
        if existing is None:
            await self._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                civilization_id=None,
                value=value,
                metadata=dict(metadata),
                civilizations_by_id=ctx.civilizations_by_id,
                contract_cache=ctx.contract_cache,
                execution_context=ctx,
            )
            civilization_id = uuid4()
            created_event = await ctx.append_and_project_event(
                entity_id=civilization_id,
                event_type="CIVILIZATION_CREATED",
                payload={"value": value, "metadata": metadata},
            )
            civilization = ProjectedCivilization(
                id=civilization_id,
                value=value,
                metadata=dict(metadata),
                is_deleted=False,
                created_at=created_event.timestamp,
                deleted_at=None,
                current_event_seq=int(created_event.event_seq),
            )
            ctx.civilizations_by_id[civilization.id] = civilization
            self._record_semantic_effect(
                ctx=ctx,
                code="CIVILIZATION_UPSERTED",
                reason="Civilization row was created from INGEST command.",
                task_action=action,
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
            civilization = existing
            previous_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
            previous_table_id = self._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=civilization.value,
                metadata=civilization.metadata,
            )
            metadata_update = {k: v for k, v in metadata.items() if civilization.metadata.get(k) != v}
            if metadata_update:
                next_metadata = {**civilization.metadata, **metadata_update}
                await self._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    civilization_id=civilization.id,
                    value=civilization.value,
                    metadata=next_metadata,
                    civilizations_by_id=ctx.civilizations_by_id,
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
                next_table_id = self._projected_table_id_for_value(
                    galaxy_id=ctx.galaxy_id,
                    value=civilization.value,
                    metadata=civilization.metadata,
                )
                self._record_semantic_effect(
                    ctx=ctx,
                    code="CIVILIZATION_UPSERTED",
                    reason="Existing civilization metadata was synchronized from INGEST command.",
                    task_action=action,
                    rule_id="sem.upsert.ingest",
                    inputs={
                        "civilization_id": civilization.id,
                        "metadata_patch_keys": sorted(list(metadata_update.keys())),
                    },
                    outputs={"civilization_id": civilization.id, "created": False, "table_id": next_table_id},
                )
                if previous_table_id != next_table_id:
                    next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
                    self._record_semantic_effect(
                        ctx=ctx,
                        code="CIVILIZATION_RECLASSIFIED",
                        reason="Civilization changed table classification after metadata update.",
                        task_action=action,
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

        await self._apply_auto_semantics_for_civilization(
            ctx=ctx,
            civilization=civilization,
            trigger_action=action,
        )
        ctx.context_civilization_ids.append(civilization.id)
        ctx.result.civilizations.append(civilization)
        return True

    if action == "UPDATE_CIVILIZATION":
        civilization_uuid = self._parse_uuid(task.params.get("civilization_id"))
        if civilization_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="UPDATE_CIVILIZATION requires valid civilization_id",
            )

        civilization = ctx.civilizations_by_id.get(civilization_uuid)
        if civilization is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target civilization not found")
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=civilization_uuid,
            expected_event_seq=expected_event_seq,
            context=f"UPDATE_CIVILIZATION {civilization_uuid}",
        )

        has_change = False
        next_value = civilization.value
        next_metadata = dict(civilization.metadata)
        previous_table_name = derive_table_name(value=civilization.value, metadata=civilization.metadata)
        previous_table_id = self._projected_table_id_for_value(
            galaxy_id=ctx.galaxy_id,
            value=civilization.value,
            metadata=civilization.metadata,
        )
        active_table_ids_before = {
            self._projected_table_id_for_value(
                galaxy_id=ctx.galaxy_id,
                value=item.value,
                metadata=item.metadata,
            )
            for item in ctx.civilizations_by_id.values()
            if not item.is_deleted
        }
        if "value" in task.params:
            next_value = task.params.get("value")
            if civilization.value != next_value:
                has_change = True

        raw_metadata = task.params.get("metadata")
        if isinstance(raw_metadata, dict) and raw_metadata:
            metadata_update = {k: v for k, v in raw_metadata.items() if civilization.metadata.get(k) != v}
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

        current_lifecycle_state = _normalize_lifecycle_state(civilization)
        touched_lifecycle_keys = {
            key
            for key in [*metadata_update.keys(), *removed_metadata_keys]
            if str(key).strip().lower() in {"state", "status"}
        }
        if touched_lifecycle_keys:
            if "state" in metadata_update and "status" in metadata_update:
                state_value = str(metadata_update.get("state") or "").strip().upper()
                status_value = str(metadata_update.get("status") or "").strip().upper()
                if state_value and status_value and state_value != status_value:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail={
                            "code": "LIFECYCLE_TRANSITION_BLOCKED",
                            "reason": "ambiguous_state_patch",
                            "message": (
                                "UPDATE_CIVILIZATION lifecycle patch is ambiguous " "(`state` and `status` mismatch)."
                            ),
                            "from_state": current_lifecycle_state,
                        },
                    )
            if "state" in removed_metadata_keys or "status" in removed_metadata_keys:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail={
                        "code": "LIFECYCLE_TRANSITION_BLOCKED",
                        "reason": "state_remove_not_allowed",
                        "message": "Lifecycle state cannot be removed from civilization metadata.",
                        "from_state": current_lifecycle_state,
                    },
                )
            target_lifecycle_state = (
                str(
                    next_metadata.get("state", next_metadata.get("status"))
                    or metadata_update.get("state", metadata_update.get("status"))
                    or ""
                )
                .strip()
                .upper()
            )
            if not _can_transition_lifecycle(current_lifecycle_state, target_lifecycle_state):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail={
                        "code": "LIFECYCLE_TRANSITION_BLOCKED",
                        "reason": "invalid_transition",
                        "message": (
                            f"Lifecycle transition '{current_lifecycle_state}' -> "
                            f"'{target_lifecycle_state or 'UNKNOWN'}' is not allowed."
                        ),
                        "from_state": current_lifecycle_state,
                        "target_state": target_lifecycle_state or None,
                    },
                )
        elif current_lifecycle_state == "ARCHIVED":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "code": "LIFECYCLE_TRANSITION_BLOCKED",
                    "reason": "archived_readonly",
                    "message": "Archived civilization is read-only. Use lifecycle transition first.",
                    "from_state": current_lifecycle_state,
                },
            )

        if not has_change:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No effective update for civilization",
            )

        await self._validate_table_contract_write(
            session=ctx.session,
            galaxy_id=ctx.galaxy_id,
            civilization_id=civilization.id,
            value=next_value,
            metadata=next_metadata,
            civilizations_by_id=ctx.civilizations_by_id,
            contract_cache=ctx.contract_cache,
            execution_context=ctx,
        )

        if civilization.value != next_value:
            value_event = await ctx.append_and_project_event(
                entity_id=civilization.id,
                event_type="CIVILIZATION_VALUE_UPDATED",
                payload={"value": next_value},
            )
            civilization.current_event_seq = int(value_event.event_seq)
            civilization.value = next_value

        if civilization.metadata != next_metadata:
            metadata_update = {
                key: value for key, value in next_metadata.items() if civilization.metadata.get(key) != value
            }
            if metadata_update or removed_metadata_keys:
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
        next_table_id = self._projected_table_id_for_value(
            galaxy_id=ctx.galaxy_id,
            value=civilization.value,
            metadata=civilization.metadata,
        )
        self._record_semantic_effect(
            ctx=ctx,
            code="CIVILIZATION_UPDATED",
            reason="Civilization value or metadata was updated.",
            task_action=action,
            rule_id="sem.update.civilization",
            inputs={"civilization_id": civilization.id},
            outputs={"civilization_id": civilization.id, "table_id": next_table_id},
        )
        if previous_table_id != next_table_id:
            next_constellation_name, next_planet_name = split_constellation_and_planet_name(next_table_name)
            self._record_semantic_effect(
                ctx=ctx,
                code="CIVILIZATION_RECLASSIFIED",
                reason="Civilization moved to another planet/table after update.",
                task_action=action,
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

        await self._apply_auto_semantics_for_civilization(
            ctx=ctx,
            civilization=civilization,
            trigger_action=action,
        )
        ctx.result.civilizations.append(civilization)
        return True

    return False
