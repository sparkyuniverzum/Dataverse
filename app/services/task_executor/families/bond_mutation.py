from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select, text as sql_text

from app.models import Bond
from app.services.bond_semantics import normalize_bond_type
from app.services.parser_service import AtomicTask
from app.services.universe_service import ProjectedBond

if TYPE_CHECKING:
    from app.services.task_executor_service import TaskExecutorService, _TaskExecutionContext


async def handle_link_and_bond_mutation_family(
    self: TaskExecutorService,
    *,
    task: AtomicTask,
    ctx: _TaskExecutionContext,
) -> bool:
    action = task.action.upper()
    if action == "LINK":
        source_id = task.params.get("source_id")
        target_id = task.params.get("target_id")
        if source_id is None or target_id is None:
            if len(ctx.context_asteroid_ids) < 2:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="LINK task requires source_id/target_id or two previous INGEST tasks",
                )
            source_id = ctx.context_asteroid_ids[-2]
            target_id = ctx.context_asteroid_ids[-1]

        source_uuid = UUID(str(source_id))
        target_uuid = UUID(str(target_id))
        if source_uuid == target_uuid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="source_id and target_id must be different",
            )
        if source_uuid not in ctx.asteroids_by_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source asteroid not found")
        if target_uuid not in ctx.asteroids_by_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target asteroid not found")

        expected_source_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_source_event_seq"),
            field_name="expected_source_event_seq",
        )
        expected_target_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_target_event_seq"),
            field_name="expected_target_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=source_uuid,
            expected_event_seq=expected_source_event_seq,
            context=f"LINK source {source_uuid}",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=target_uuid,
            expected_event_seq=expected_target_event_seq,
            context=f"LINK target {target_uuid}",
        )

        bond_type = normalize_bond_type(task.params.get("type", "RELATION"))
        is_relation = bond_type == "RELATION"
        if is_relation:
            source_uuid, target_uuid = self._canonical_relation_pair(source_uuid, target_uuid)
        existing_bond = next(
            (
                bond
                for bond in ctx.bonds_by_id.values()
                if str(bond.type or "").upper() == bond_type
                and (
                    (bond.source_id == source_uuid and bond.target_id == target_uuid)
                    or (is_relation and bond.source_id == target_uuid and bond.target_id == source_uuid)
                )
            ),
            None,
        )
        if existing_bond is not None:
            ctx.result.bonds.append(existing_bond)
            self._record_semantic_effect(
                ctx=ctx,
                code="BOND_REUSED",
                reason="Existing bond already satisfies the semantic link request.",
                task_action=action,
                rule_id="sem.link.reuse",
                inputs={"source_id": source_uuid, "target_id": target_uuid, "type": bond_type},
                outputs={"bond_id": existing_bond.id, "created": False},
            )
            return True

        lock_key = self._bond_lock_key(
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            source_id=source_uuid,
            target_id=target_uuid,
            bond_type=bond_type,
        )
        await ctx.session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

        bond_match_predicate = and_(
            Bond.user_id == ctx.user_id,
            Bond.galaxy_id == ctx.galaxy_id,
            func.upper(Bond.type) == bond_type,
            Bond.is_deleted.is_(False),
        )
        if is_relation:
            bond_match_predicate = and_(
                bond_match_predicate,
                or_(
                    and_(Bond.source_id == source_uuid, Bond.target_id == target_uuid),
                    and_(Bond.source_id == target_uuid, Bond.target_id == source_uuid),
                ),
            )
        else:
            bond_match_predicate = and_(
                bond_match_predicate,
                Bond.source_id == source_uuid,
                Bond.target_id == target_uuid,
            )

        persisted_bond = (await ctx.session.execute(select(Bond).where(bond_match_predicate))).scalar_one_or_none()
        if persisted_bond is not None:
            persisted_seq = await self._current_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=persisted_bond.id,
            )
            projected = self._to_projected_bond(persisted_bond, current_event_seq=persisted_seq)
            ctx.bonds_by_id[projected.id] = projected
            ctx.result.bonds.append(projected)
            return True

        bond_id = uuid4()
        bond_payload = {
            "source_id": str(source_uuid),
            "target_id": str(target_uuid),
            "type": bond_type,
        }
        raw_bond_metadata = task.params.get("metadata")
        if isinstance(raw_bond_metadata, dict) and raw_bond_metadata:
            bond_payload["metadata"] = raw_bond_metadata

        bond_event = await ctx.append_and_project_event(
            entity_id=bond_id,
            event_type="BOND_FORMED",
            payload=bond_payload,
        )
        bond = ProjectedBond(
            id=bond_id,
            source_id=source_uuid,
            target_id=target_uuid,
            type=bond_type,
            is_deleted=False,
            created_at=bond_event.timestamp,
            deleted_at=None,
            current_event_seq=int(bond_event.event_seq),
        )
        ctx.bonds_by_id[bond.id] = bond
        ctx.result.bonds.append(bond)
        self._record_semantic_effect(
            ctx=ctx,
            code="BOND_CREATED",
            reason="New semantic bond was created.",
            task_action=action,
            rule_id="sem.link.create",
            inputs={"source_id": source_uuid, "target_id": target_uuid, "type": bond_type},
            outputs={"bond_id": bond.id, "created": True},
        )
        return True

    if action == "UPDATE_BOND":
        bond_uuid = self._parse_uuid(task.params.get("bond_id"))
        if bond_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="UPDATE_BOND requires valid bond_id",
            )
        bond = ctx.bonds_by_id.get(bond_uuid)
        if bond is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

        raw_type = str(task.params.get("type", "")).strip()
        if not raw_type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="UPDATE_BOND requires non-empty type",
            )
        next_type = normalize_bond_type(raw_type)
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=bond.id,
            expected_event_seq=expected_event_seq,
            context=f"UPDATE_BOND {bond.id}",
        )

        current_type = normalize_bond_type(bond.type)
        if next_type == current_type:
            ctx.result.bonds.append(bond)
            self._record_semantic_effect(
                ctx=ctx,
                code="BOND_REUSED",
                reason="Requested bond type is already active.",
                task_action=action,
                rule_id="sem.bond.noop",
                inputs={"bond_id": bond.id, "type": current_type},
                outputs={"bond_id": bond.id, "created": False},
            )
            return True

        source_uuid = bond.source_id
        target_uuid = bond.target_id
        next_is_relation = next_type == "RELATION"
        if next_is_relation:
            source_uuid, target_uuid = self._canonical_relation_pair(source_uuid, target_uuid)

        duplicate = next(
            (
                candidate
                for candidate in ctx.bonds_by_id.values()
                if candidate.id != bond.id
                and normalize_bond_type(candidate.type) == next_type
                and (
                    (candidate.source_id == source_uuid and candidate.target_id == target_uuid)
                    or (next_is_relation and candidate.source_id == target_uuid and candidate.target_id == source_uuid)
                )
            ),
            None,
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "BOND_TYPE_CONFLICT",
                    "message": "Target bond type already exists for this edge",
                    "bond_id": str(duplicate.id),
                },
            )

        replaced_event = await ctx.append_and_project_event(
            entity_id=bond.id,
            event_type="BOND_SOFT_DELETED",
            payload={"replaced_by_type": next_type},
        )
        bond.is_deleted = True
        bond.deleted_at = replaced_event.timestamp
        bond.current_event_seq = int(replaced_event.event_seq)
        if bond.id not in ctx.result.extinguished_bond_ids:
            ctx.result.extinguished_bond_ids.append(bond.id)
        ctx.bonds_by_id.pop(bond.id, None)

        new_bond_id = uuid4()
        formed_event = await ctx.append_and_project_event(
            entity_id=new_bond_id,
            event_type="BOND_FORMED",
            payload={
                "source_id": str(source_uuid),
                "target_id": str(target_uuid),
                "type": next_type,
            },
        )
        new_bond = ProjectedBond(
            id=new_bond_id,
            source_id=source_uuid,
            target_id=target_uuid,
            type=next_type,
            is_deleted=False,
            created_at=formed_event.timestamp,
            deleted_at=None,
            current_event_seq=int(formed_event.event_seq),
        )
        ctx.bonds_by_id[new_bond.id] = new_bond
        ctx.result.bonds.append(new_bond)
        self._record_semantic_effect(
            ctx=ctx,
            code="BOND_RETYPED",
            reason="Bond type was changed by replacing old bond with a new canonical edge.",
            task_action=action,
            rule_id="sem.bond.retype",
            inputs={"bond_id": bond.id, "from_type": current_type, "to_type": next_type},
            outputs={"bond_id": new_bond.id, "source_id": source_uuid, "target_id": target_uuid},
        )
        return True

    return False
