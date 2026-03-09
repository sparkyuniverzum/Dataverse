from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schema_models.execution import ParseCommandRequest
from app.services.parser2 import Parser2SemanticPlanner, SnapshotSemanticResolver, parser_v2_fallback_to_v1_enabled
from app.services.parser_service import AtomicTask


@dataclass
class ScopedContext:
    galaxy_id: UUID | None = None
    branch_id: UUID | None = None

    @property
    def resolved_scope(self) -> tuple[UUID, UUID | None] | None:
        if self.galaxy_id is None:
            return None
        return self.galaxy_id, self.branch_id


async def resolve_tasks_for_payload(
    *,
    payload: ParseCommandRequest,
    session: AsyncSession,
    current_user_id: UUID,
    services: Any,
    ensure_scope: Callable[[], Awaitable[tuple[UUID, UUID | None]]],
) -> list[AtomicTask]:
    tasks: list[AtomicTask]
    parser_version_explicit = "parser_version" in payload.model_fields_set
    if payload.parser_version == "v2":
        v2_error_message: str | None = None
        v2_runtime_failed = False
        try:
            scoped_galaxy_id, scoped_branch_id = await ensure_scope()
            active_asteroids, _ = await services.universe_service.project_state(
                session=session,
                user_id=current_user_id,
                galaxy_id=scoped_galaxy_id,
                branch_id=scoped_branch_id,
                apply_calculations=False,
            )
            semantic_planner = Parser2SemanticPlanner(
                parser=services.parser2_planner.parser,
                resolver=SnapshotSemanticResolver(active_asteroids),
            )
            plan_result = semantic_planner.plan_text(payload.command)
            if plan_result.errors:
                v2_error_message = plan_result.errors[0].message
            elif plan_result.envelope is None:
                v2_error_message = "Parser2 did not produce intent envelope"
            else:
                bridge_result = services.parser2_executor_bridge.to_atomic_tasks(plan_result.envelope)
                if bridge_result.errors:
                    v2_error_message = bridge_result.errors[0].message
                else:
                    tasks = bridge_result.tasks
        except Exception:
            # Keep parser endpoint resilient; fall back to v1 parser when v2 runtime fails.
            v2_runtime_failed = True

        if v2_error_message is not None:
            if parser_version_explicit or not parser_v2_fallback_to_v1_enabled():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {v2_error_message}",
                )

            parse_result = services.parser_service.parse_with_diagnostics(payload.command)
            if parse_result.errors:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {v2_error_message}",
                )
            tasks = parse_result.tasks
        elif v2_runtime_failed:
            try:
                parse_result = services.parser_service.parse_with_diagnostics(payload.command)
                if parse_result.errors:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Parse error: {parse_result.errors[0]}",
                    )
                tasks = parse_result.tasks
            except HTTPException:
                if parser_version_explicit:
                    raise
                # Last-resort fallback for parser-plan resiliency.
                tasks = [AtomicTask(action="INGEST", params={"value": payload.command})]
    else:
        try:
            parse_result = services.parser_service.parse_with_diagnostics(payload.command)
            if parse_result.errors:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {parse_result.errors[0]}",
                )
            tasks = parse_result.tasks
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Parse error: {type(exc).__name__}",
            ) from exc
    return tasks
