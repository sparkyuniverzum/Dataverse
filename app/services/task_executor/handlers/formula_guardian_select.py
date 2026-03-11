from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import HTTPException, status

from app.infrastructure.runtime.parser2.intents import AddGuardianIntent, Intent, SelectNodesIntent, SetFormulaIntent

if TYPE_CHECKING:
    from app.services.task_executor.service import TaskExecutorService, _TaskExecutionContext


class FormulaGuardianSelectHandler:
    def __init__(self, service: TaskExecutorService):
        self.service = service

    async def handle(self, *, task: Intent, ctx: _TaskExecutionContext) -> bool:
        if isinstance(task, SelectNodesIntent):
            selected = self.service._find_civilizations_by_target(
                civilizations=list(ctx.civilizations_by_id.values()),
                target=str(task.target.value),
                condition=task.condition,
            )
            ctx.result.selected_civilizations.extend(selected)
            return True

        if isinstance(task, SetFormulaIntent):
            target_civilization = self.service._resolve_single_civilization_by_target(
                list(ctx.civilizations_by_id.values()), str(task.target.value)
            )
            if target_civilization is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target civilization not found",
                )
            expected_event_seq = None  # Not supported in intent yet
            await self.service._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=target_civilization.id,
                expected_event_seq=expected_event_seq,
                context=f"SET_FORMULA {target_civilization.id}",
            )

            field_name = str(task.field).strip()
            formula_value = str(task.formula).strip()
            if target_civilization.metadata.get(field_name) != formula_value:
                next_metadata = {**target_civilization.metadata, field_name: formula_value}
                await self.service._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    civilization_id=target_civilization.id,
                    value=target_civilization.value,
                    metadata=next_metadata,
                    civilizations_by_id=ctx.civilizations_by_id,
                    contract_cache=ctx.contract_cache,
                    execution_context=ctx,
                )
                formula_event = await ctx.append_and_project_event(
                    entity_id=target_civilization.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": {field_name: formula_value}},
                )
                target_civilization.current_event_seq = int(formula_event.event_seq)
                target_civilization.metadata = next_metadata
                self.service._record_semantic_effect(
                    ctx=ctx,
                    code="FORMULA_SET",
                    reason="Formula metadata was assigned to moon field.",
                    task_action="SET_FORMULA",
                    rule_id="sem.formula.assign",
                    inputs={"civilization_id": target_civilization.id, "field": field_name, "formula": formula_value},
                    outputs={"civilization_id": target_civilization.id, "field": field_name},
                )
            ctx.result.civilizations.append(target_civilization)
            return True

        if isinstance(task, AddGuardianIntent):
            operator_value = str(task.operator).strip()
            if operator_value not in {">", "<", "==", ">=", "<="}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="ADD_GUARDIAN uses unsupported operator",
                )

            target_civilization = self.service._resolve_single_civilization_by_target(
                list(ctx.civilizations_by_id.values()), str(task.target.value)
            )
            if target_civilization is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target civilization not found",
                )
            expected_event_seq = None  # Not supported in intent yet
            await self.service._enforce_expected_entity_event_seq(
                session=ctx.session,
                user_id=ctx.user_id,
                galaxy_id=ctx.galaxy_id,
                branch_id=ctx.branch_id,
                entity_id=target_civilization.id,
                expected_event_seq=expected_event_seq,
                context=f"ADD_GUARDIAN {target_civilization.id}",
            )

            existing_guardians = target_civilization.metadata.get("_guardians", [])
            guardian_rules = [dict(rule) for rule in existing_guardians if isinstance(rule, dict)]
            new_rule = {
                "field": str(task.field).strip(),
                "operator": operator_value,
                "threshold": task.threshold,
                "action": str(task.action).strip(),
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
                    **target_civilization.metadata,
                    "_guardians": [*guardian_rules, new_rule],
                }
                await self.service._validate_table_contract_write(
                    session=ctx.session,
                    galaxy_id=ctx.galaxy_id,
                    civilization_id=target_civilization.id,
                    value=target_civilization.value,
                    metadata=next_metadata,
                    civilizations_by_id=ctx.civilizations_by_id,
                    contract_cache=ctx.contract_cache,
                    execution_context=ctx,
                )
                guardian_rules.append(new_rule)
                guardian_event = await ctx.append_and_project_event(
                    entity_id=target_civilization.id,
                    event_type="METADATA_UPDATED",
                    payload={"metadata": {"_guardians": guardian_rules}},
                )
                target_civilization.current_event_seq = int(guardian_event.event_seq)
                target_civilization.metadata = {
                    **target_civilization.metadata,
                    "_guardians": guardian_rules,
                }
                self.service._record_semantic_effect(
                    ctx=ctx,
                    code="GUARDIAN_ADDED",
                    reason="Guardian rule was attached to moon metadata.",
                    task_action="ADD_GUARDIAN",
                    rule_id="sem.guardian.attach",
                    inputs={
                        "civilization_id": target_civilization.id,
                        "field": new_rule["field"],
                        "operator": new_rule["operator"],
                        "threshold": new_rule["threshold"],
                        "action": new_rule["action"],
                    },
                    outputs={"civilization_id": target_civilization.id, "guardians_count": len(guardian_rules)},
                )
            ctx.result.civilizations.append(target_civilization)
            return True

        return False
