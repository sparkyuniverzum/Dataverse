from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status

from app.core.parser2.intents import ExtinguishNodeIntent, Intent
from app.services.universe_service import ProjectedAsteroid

if TYPE_CHECKING:
    from app.core.task_executor.service import TaskExecutorService, _TaskExecutionContext


class ExtinguishHandler:
    def __init__(self, service: TaskExecutorService):
        self.service = service

    async def handle(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        if not isinstance(task, ExtinguishNodeIntent):
            return False

        targets: list[ProjectedAsteroid] = []
        civilization = self.service._find_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(task.target.value))
        if civilization:
            targets = [civilization]

        if not targets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target civilization not found",
            )
        expected_event_seq = None  # Not supported by intent yet

        if expected_event_seq is not None and len(targets) != 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="expected_event_seq can be used only with a single delete target",
            )

        processed_bond_ids: set[UUID] = set()
        for civilization in targets:
            await self.service._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=civilization.id,
                expected_event_seq=expected_event_seq,
                context=f"DELETE/EXTINGUISH {civilization.id}",
            )
            deleted_event = await ctx.append_and_project_event(
                entity_id=civilization.id,
                event_type="ASTEROID_SOFT_DELETED",
                payload={},
            )
            civilization.is_deleted = True
            civilization.deleted_at = deleted_event.timestamp
            civilization.current_event_seq = int(deleted_event.event_seq)
            ctx.result.extinguished_asteroids.append(civilization)
            if civilization.id not in ctx.result.extinguished_civilization_ids:
                ctx.result.extinguished_civilization_ids.append(civilization.id)
            self.service._record_semantic_effect(
                ctx=ctx,
                code="MOON_EXTINGUISHED",
                reason="Moon was soft-deleted.",
                task_action="EXTINGUISH",
                rule_id="sem.moon.extinguish",
                inputs={"civilization_id": civilization.id},
                outputs={"civilization_id": civilization.id, "is_deleted": True},
            )

            connected_bonds = [
                bond
                for bond in ctx.bonds_by_id.values()
                if bond.id not in processed_bond_ids
                and (bond.source_civilization_id == civilization.id or bond.target_civilization_id == civilization.id)
            ]
            for bond in connected_bonds:
                bond_deleted_event = await ctx.append_and_project_event(
                    entity_id=bond.id,
                    event_type="BOND_SOFT_DELETED",
                    payload={"civilization_id": str(civilization.id)},
                )
                bond.is_deleted = True
                bond.deleted_at = bond_deleted_event.timestamp
                bond.current_event_seq = int(bond_deleted_event.event_seq)
                processed_bond_ids.add(bond.id)
                if bond.id not in ctx.result.extinguished_bond_ids:
                    ctx.result.extinguished_bond_ids.append(bond.id)
                ctx.bonds_by_id.pop(bond.id, None)
                self.service._record_semantic_effect(
                    ctx=ctx,
                    code="BOND_EXTINGUISHED",
                    reason="Connected bond was soft-deleted because its moon endpoint was extinguished.",
                    task_action="EXTINGUISH",
                    rule_id="sem.bond.cascade_extinguish",
                    inputs={"bond_id": bond.id, "civilization_id": civilization.id},
                    outputs={"bond_id": bond.id, "is_deleted": True},
                )

            ctx.asteroids_by_id.pop(civilization.id, None)

        ctx.bonds_by_id = {
            bond_id: bond
            for bond_id, bond in ctx.bonds_by_id.items()
            if bond.source_civilization_id in ctx.asteroids_by_id and bond.target_civilization_id in ctx.asteroids_by_id
        }
        return True
