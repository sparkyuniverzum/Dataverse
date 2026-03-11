from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select

from app.core.parser2.intents import CreateLinkIntent, Intent
from app.domains.bonds.semantics import normalize_bond_type
from app.models import Bond
from app.services.db_advisory_lock import acquire_transaction_lock
from app.services.universe_service import ProjectedBond

if TYPE_CHECKING:
    from app.core.task_executor.service import TaskExecutorService, _TaskExecutionContext


class LinkMutationHandler:
    def __init__(self, service: TaskExecutorService):
        self.service = service

    async def handle(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        if not isinstance(task, CreateLinkIntent):
            return False

        source_civilization = self.service._resolve_single_civilization_by_target(
            civilizations=list(ctx.civilizations_by_id.values()), target=task.source.value
        )
        target_civilization = self.service._resolve_single_civilization_by_target(
            civilizations=list(ctx.civilizations_by_id.values()), target=task.target.value
        )

        if source_civilization is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source civilization not found")
        if target_civilization is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target civilization not found")

        source_uuid = source_civilization.id
        target_uuid = target_civilization.id
        if source_uuid == target_uuid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="source_civilization_id and target_civilization_id must be different",
            )

        await self.service._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=source_uuid,
            expected_event_seq=None,
            context=f"LINK source {source_uuid}",
        )
        await self.service._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=target_uuid,
            expected_event_seq=None,
            context=f"LINK target {target_uuid}",
        )

        bond_type = normalize_bond_type(str(task.link_type.value))
        is_relation = bond_type == "RELATION"
        if is_relation:
            source_uuid, target_uuid = self.service._canonical_relation_pair(source_uuid, target_uuid)
        existing_bond = next(
            (
                bond
                for bond in ctx.bonds_by_id.values()
                if str(bond.type or "").upper() == bond_type
                and (
                    (bond.source_civilization_id == source_uuid and bond.target_civilization_id == target_uuid)
                    or (
                        is_relation
                        and bond.source_civilization_id == target_uuid
                        and bond.target_civilization_id == source_uuid
                    )
                )
            ),
            None,
        )
        if existing_bond is not None:
            ctx.result.bonds.append(existing_bond)
            self.service._record_semantic_effect(
                ctx=ctx,
                code="BOND_REUSED",
                reason="Existing bond already satisfies the semantic link request.",
                task_action="LINK",
                rule_id="sem.link.reuse",
                inputs={
                    "source_civilization_id": source_uuid,
                    "target_civilization_id": target_uuid,
                    "type": bond_type,
                },
                outputs={"bond_id": existing_bond.id, "created": False},
            )
            return True

        lock_key = self.service._bond_lock_key(
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            source_civilization_id=source_uuid,
            target_civilization_id=target_uuid,
            bond_type=bond_type,
        )
        await acquire_transaction_lock(ctx.session, key=lock_key)

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
                    and_(Bond.source_civilization_id == source_uuid, Bond.target_civilization_id == target_uuid),
                    and_(Bond.source_civilization_id == target_uuid, Bond.target_civilization_id == source_uuid),
                ),
            )
        else:
            bond_match_predicate = and_(
                bond_match_predicate,
                Bond.source_civilization_id == source_uuid,
                Bond.target_civilization_id == target_uuid,
            )

        persisted_bond = (await ctx.session.execute(select(Bond).where(bond_match_predicate))).scalar_one_or_none()
        if persisted_bond is not None:
            persisted_seq = await self.service._current_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=persisted_bond.id,
            )
            projected = self.service._to_projected_bond(persisted_bond, current_event_seq=persisted_seq)
            ctx.bonds_by_id[projected.id] = projected
            ctx.result.bonds.append(projected)
            return True

        bond_id = uuid4()
        bond_payload = {
            "source_civilization_id": str(source_uuid),
            "target_civilization_id": str(target_uuid),
            "type": bond_type,
        }
        raw_bond_metadata = task.metadata
        if isinstance(raw_bond_metadata, dict) and raw_bond_metadata:
            bond_payload["metadata"] = raw_bond_metadata

        bond_event = await ctx.append_and_project_event(
            entity_id=bond_id,
            event_type="BOND_FORMED",
            payload=bond_payload,
        )
        bond = ProjectedBond(
            id=bond_id,
            source_civilization_id=source_uuid,
            target_civilization_id=target_uuid,
            type=bond_type,
            is_deleted=False,
            created_at=bond_event.timestamp,
            deleted_at=None,
            current_event_seq=int(bond_event.event_seq),
        )
        ctx.bonds_by_id[bond.id] = bond
        ctx.result.bonds.append(bond)
        self.service._record_semantic_effect(
            ctx=ctx,
            code="BOND_CREATED",
            reason="New semantic bond was created.",
            task_action="LINK",
            rule_id="sem.link.create",
            inputs={"source_civilization_id": source_uuid, "target_civilization_id": target_uuid, "type": bond_type},
            outputs={"bond_id": bond.id, "created": True},
        )
        return True
