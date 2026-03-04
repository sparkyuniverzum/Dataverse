from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException, status

from app.services.parser_service import AtomicTask

if TYPE_CHECKING:
    from app.services.task_executor_service import TaskExecutorService, _TaskExecutionContext


async def handle_formula_guardian_select_family(
    self: TaskExecutorService,
    *,
    task: AtomicTask,
    ctx: _TaskExecutionContext,
) -> bool:
    action = task.action.upper()
    if action == "SELECT":
        target = (
            task.params.get("target_asteroid")
            or task.params.get("target_planet")
            or task.params.get("target")
        )
        if not target:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="SELECT task requires target_asteroid",
            )
        selected = self._find_asteroids_by_target(
            asteroids=list(ctx.asteroids_by_id.values()),
            target=str(target),
            condition=(str(task.params["condition"]) if task.params.get("condition") else None),
        )
        ctx.result.selected_asteroids.extend(selected)
        return True

    if action == "SET_FORMULA":
        target = task.params.get("target")
        field = task.params.get("field")
        formula = task.params.get("formula")
        if not target or not field or not formula:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="SET_FORMULA task requires target, field, and formula",
            )

        target_asteroid = self._resolve_single_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(target))
        if target_asteroid is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target asteroid not found",
            )
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=target_asteroid.id,
            expected_event_seq=expected_event_seq,
            context=f"SET_FORMULA {target_asteroid.id}",
        )

        field_name = str(field).strip()
        formula_value = str(formula).strip()
        if target_asteroid.metadata.get(field_name) != formula_value:
            next_metadata = {**target_asteroid.metadata, field_name: formula_value}
            await self._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                asteroid_id=target_asteroid.id,
                value=target_asteroid.value,
                metadata=next_metadata,
                asteroids_by_id=ctx.asteroids_by_id,
                contract_cache=ctx.contract_cache,
                execution_context=ctx,
            )
            formula_event = await ctx.append_and_project_event(
                entity_id=target_asteroid.id,
                event_type="METADATA_UPDATED",
                payload={"metadata": {field_name: formula_value}},
            )
            target_asteroid.current_event_seq = int(formula_event.event_seq)
            target_asteroid.metadata = next_metadata
            self._record_semantic_effect(
                ctx=ctx,
                code="FORMULA_SET",
                reason="Formula metadata was assigned to moon field.",
                task_action=action,
                rule_id="sem.formula.assign",
                inputs={"asteroid_id": target_asteroid.id, "field": field_name, "formula": formula_value},
                outputs={"asteroid_id": target_asteroid.id, "field": field_name},
            )
        ctx.result.asteroids.append(target_asteroid)
        return True

    if action == "ADD_GUARDIAN":
        target = task.params.get("target")
        field = task.params.get("field")
        operator = task.params.get("operator")
        threshold = task.params.get("threshold")
        action_name = task.params.get("action")
        if not target or not field or not operator or action_name is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="ADD_GUARDIAN task requires target, field, operator, threshold, and action",
            )

        operator_value = str(operator).strip()
        if operator_value not in {">", "<", "==", ">=", "<="}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="ADD_GUARDIAN uses unsupported operator",
            )

        target_asteroid = self._resolve_single_asteroid_by_target(list(ctx.asteroids_by_id.values()), str(target))
        if target_asteroid is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target asteroid not found",
            )
        expected_event_seq = self._parse_expected_event_seq(
            task.params.get("expected_event_seq"),
            field_name="expected_event_seq",
        )
        await self._enforce_expected_entity_event_seq(
            session=ctx.session,
            user_id=ctx.user_id,
            galaxy_id=ctx.galaxy_id,
            branch_id=ctx.branch_id,
            entity_id=target_asteroid.id,
            expected_event_seq=expected_event_seq,
            context=f"ADD_GUARDIAN {target_asteroid.id}",
        )

        existing_guardians = target_asteroid.metadata.get("_guardians", [])
        guardian_rules = [dict(rule) for rule in existing_guardians if isinstance(rule, dict)]
        new_rule = {
            "field": str(field).strip(),
            "operator": operator_value,
            "threshold": threshold,
            "action": str(action_name).strip(),
        }
        signature = (
            new_rule["field"],
            new_rule["operator"],
            new_rule["threshold"],
            new_rule["action"],
        )
        existing_signatures = {
            (
                str(rule.get("field", "")).strip(),
                str(rule.get("operator", "")).strip(),
                rule.get("threshold"),
                str(rule.get("action", "")).strip(),
            )
            for rule in guardian_rules
            if isinstance(rule, dict)
        }

        if signature not in existing_signatures:
            next_metadata = {
                **target_asteroid.metadata,
                "_guardians": [*guardian_rules, new_rule],
            }
            await self._validate_table_contract_write(
                session=ctx.session,
                galaxy_id=ctx.galaxy_id,
                asteroid_id=target_asteroid.id,
                value=target_asteroid.value,
                metadata=next_metadata,
                asteroids_by_id=ctx.asteroids_by_id,
                contract_cache=ctx.contract_cache,
                execution_context=ctx,
            )
            guardian_rules.append(new_rule)
            guardian_event = await ctx.append_and_project_event(
                entity_id=target_asteroid.id,
                event_type="METADATA_UPDATED",
                payload={"metadata": {"_guardians": guardian_rules}},
            )
            target_asteroid.current_event_seq = int(guardian_event.event_seq)
            target_asteroid.metadata = {
                **target_asteroid.metadata,
                "_guardians": guardian_rules,
            }
            self._record_semantic_effect(
                ctx=ctx,
                code="GUARDIAN_ADDED",
                reason="Guardian rule was attached to moon metadata.",
                task_action=action,
                rule_id="sem.guardian.attach",
                inputs={
                    "asteroid_id": target_asteroid.id,
                    "field": new_rule["field"],
                    "operator": new_rule["operator"],
                    "threshold": new_rule["threshold"],
                    "action": new_rule["action"],
                },
                outputs={"asteroid_id": target_asteroid.id, "guardians_count": len(guardian_rules)},
            )
        ctx.result.asteroids.append(target_asteroid)
        return True

    return False
