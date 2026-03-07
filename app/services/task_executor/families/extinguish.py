from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status

from app.services.parser_service import AtomicTask
from app.services.universe_service import ProjectedAsteroid

if TYPE_CHECKING:
    from app.services.task_executor_service import TaskExecutorService, _TaskExecutionContext


async def handle_extinguish_family(
    self: TaskExecutorService,
    *,
    task: AtomicTask,
    ctx: _TaskExecutionContext,
) -> bool:
    action = task.action.upper()
    if action == "EXTINGUISH_BOND":
        bond_uuid = self._parse_uuid(task.params.get("bond_id"))
        if bond_uuid is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="EXTINGUISH_BOND requires valid bond_id",
            )
        bond = ctx.bonds_by_id.get(bond_uuid)
        if bond is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")

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
            context=f"EXTINGUISH_BOND {bond.id}",
        )
        deleted_event = await ctx.append_and_project_event(
            entity_id=bond.id,
            event_type="BOND_SOFT_DELETED",
            payload={},
        )
        bond.is_deleted = True
        bond.deleted_at = deleted_event.timestamp
        bond.current_event_seq = int(deleted_event.event_seq)
        ctx.bonds_by_id.pop(bond.id, None)
        ctx.result.bonds.append(bond)
        if bond.id not in ctx.result.extinguished_bond_ids:
            ctx.result.extinguished_bond_ids.append(bond.id)
        self._record_semantic_effect(
            ctx=ctx,
            code="BOND_EXTINGUISHED",
            reason="Bond was soft-deleted.",
            task_action=action,
            rule_id="sem.bond.extinguish",
            inputs={"bond_id": bond.id},
            outputs={"bond_id": bond.id, "is_deleted": True},
        )
        return True

    if action in {"DELETE", "EXTINGUISH"}:
        asteroid_id = task.params.get("asteroid_id") or task.params.get("atom_id")
        target = task.params.get("target_asteroid") or task.params.get("target_planet")
        delete_target = task.params.get("target")
        condition = task.params.get("condition")

        targets: list[ProjectedAsteroid] = []
        if asteroid_id:
            asteroid_uuid = self._parse_uuid(asteroid_id)
            if asteroid_uuid is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Invalid asteroid_id format",
                )
            asteroid = ctx.asteroids_by_id.get(asteroid_uuid)
            if asteroid:
                targets = [asteroid]
        elif target:
            targets = self._find_asteroids_by_target(
                asteroids=list(ctx.asteroids_by_id.values()),
                target=str(target),
                condition=(str(condition) if condition else None),
            )
        elif delete_target:
            asteroid = self._find_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(delete_target))
            if asteroid:
                targets = [asteroid]
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="DELETE/EXTINGUISH task requires asteroid_id, target_asteroid, or target",
            )

        if not targets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target asteroid not found",
            )
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        if expected_event_seq is not None and len(targets) != 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="expected_event_seq can be used only with a single delete target",
            )

        processed_bond_ids: set[UUID] = set()
        for asteroid in targets:
            await self._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=asteroid.id,
                expected_event_seq=expected_event_seq,
                context=f"DELETE/EXTINGUISH {asteroid.id}",
            )
            deleted_event = await ctx.append_and_project_event(
                entity_id=asteroid.id,
                event_type="ASTEROID_SOFT_DELETED",
                payload={},
            )
            asteroid.is_deleted = True
            asteroid.deleted_at = deleted_event.timestamp
            asteroid.current_event_seq = int(deleted_event.event_seq)
            ctx.result.extinguished_asteroids.append(asteroid)
            if asteroid.id not in ctx.result.extinguished_asteroid_ids:
                ctx.result.extinguished_asteroid_ids.append(asteroid.id)
            self._record_semantic_effect(
                ctx=ctx,
                code="MOON_EXTINGUISHED",
                reason="Moon was soft-deleted.",
                task_action=action,
                rule_id="sem.moon.extinguish",
                inputs={"asteroid_id": asteroid.id},
                outputs={"asteroid_id": asteroid.id, "is_deleted": True},
            )

            connected_bonds = [
                bond
                for bond in ctx.bonds_by_id.values()
                if bond.id not in processed_bond_ids
                and (bond.source_civilization_id == asteroid.id or bond.target_civilization_id == asteroid.id)
            ]
            for bond in connected_bonds:
                bond_deleted_event = await ctx.append_and_project_event(
                    entity_id=bond.id,
                    event_type="BOND_SOFT_DELETED",
                    payload={"asteroid_id": str(asteroid.id)},
                )
                bond.is_deleted = True
                bond.deleted_at = bond_deleted_event.timestamp
                bond.current_event_seq = int(bond_deleted_event.event_seq)
                processed_bond_ids.add(bond.id)
                if bond.id not in ctx.result.extinguished_bond_ids:
                    ctx.result.extinguished_bond_ids.append(bond.id)
                ctx.bonds_by_id.pop(bond.id, None)
                self._record_semantic_effect(
                    ctx=ctx,
                    code="BOND_EXTINGUISHED",
                    reason="Connected bond was soft-deleted because its moon endpoint was extinguished.",
                    task_action=action,
                    rule_id="sem.bond.cascade_extinguish",
                    inputs={"bond_id": bond.id, "asteroid_id": asteroid.id},
                    outputs={"bond_id": bond.id, "is_deleted": True},
                )

            ctx.asteroids_by_id.pop(asteroid.id, None)

        ctx.bonds_by_id = {
            bond_id: bond
            for bond_id, bond in ctx.bonds_by_id.items()
            if bond.source_civilization_id in ctx.asteroids_by_id and bond.target_civilization_id in ctx.asteroids_by_id
        }
        return True

    return False
