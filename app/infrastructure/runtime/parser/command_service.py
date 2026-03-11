from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.observability.logging_helpers import structured_log_extra
from app.infrastructure.runtime.parser2 import (
    Parser2SemanticPlanner,
    SnapshotSemanticResolver,
    parser_v2_fallback_policy_mode,
)
from app.schema_models.execution import ParseCommandRequest
from app.services.parser_types import AtomicTask

logger = logging.getLogger(__name__)


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
    fallback_policy_mode = parser_v2_fallback_policy_mode()
    parser_version_explicit = "parser_version" in payload.model_fields_set

    def _resolve_fallback_permission() -> tuple[bool, str]:
        if payload.parser_version != "v2":
            return False, "parser_version_v1"
        if fallback_policy_mode == "always":
            return True, "policy_always"
        if fallback_policy_mode == "auto_unpinned":
            if parser_version_explicit:
                return False, "policy_auto_unpinned_blocked_by_explicit_parser_version"
            return True, "policy_auto_unpinned_allowed"
        return False, "policy_disabled"

    can_fallback_to_v1, fallback_policy_reason = _resolve_fallback_permission()

    def _parse_with_v1_or_422(command: str) -> list[AtomicTask]:
        parse_result = services.parser_service.parse_with_diagnostics(command)
        if parse_result.errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Parse error: {parse_result.errors[0]}",
            )
        return parse_result.tasks

    def _log_v2_fallback(reason: str, *, detail: str) -> None:
        logger.warning(
            "parser.v2.fallback_to_v1",
            extra=structured_log_extra(
                event_name="parser.v2.fallback_to_v1",
                module="runtime.parser.command_service",
                reason=reason,
                detail=detail,
                parser_version=payload.parser_version,
                parser_version_explicit=parser_version_explicit,
                fallback_policy_mode=fallback_policy_mode,
                fallback_policy_reason=fallback_policy_reason,
                command_length=len(payload.command or ""),
            ),
        )

    def _log_v2_fallback_blocked(reason: str, *, detail: str) -> None:
        logger.info(
            "parser.v2.fallback_blocked_by_policy",
            extra=structured_log_extra(
                event_name="parser.v2.fallback_blocked_by_policy",
                module="runtime.parser.command_service",
                reason=reason,
                detail=detail,
                parser_version=payload.parser_version,
                parser_version_explicit=parser_version_explicit,
                fallback_policy_mode=fallback_policy_mode,
                fallback_policy_reason=fallback_policy_reason,
                command_length=len(payload.command or ""),
            ),
        )

    tasks: list[AtomicTask]
    if payload.parser_version == "v2":
        v2_error_message: str | None = None
        try:
            scoped_galaxy_id, scoped_branch_id = await ensure_scope()
            active_civilizations, _ = await services.universe_service.project_state(
                session=session,
                user_id=current_user_id,
                galaxy_id=scoped_galaxy_id,
                branch_id=scoped_branch_id,
                apply_calculations=False,
            )
            semantic_planner = Parser2SemanticPlanner(
                parser=services.parser2_planner.parser,
                resolver=SnapshotSemanticResolver(active_civilizations),
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
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            if not can_fallback_to_v1:
                _log_v2_fallback_blocked(
                    "v2_runtime_failure",
                    detail=f"{type(exc).__name__}: fallback denied by policy",
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=(
                        "Parse error: parser_v2_runtime_failure "
                        f"({type(exc).__name__}; fallback_policy={fallback_policy_mode})"
                    ),
                ) from exc
            _log_v2_fallback(
                "v2_runtime_failure",
                detail=f"{type(exc).__name__}: parser2 runtime failed and policy allows v1 fallback",
            )
            return _parse_with_v1_or_422(payload.command)

        if v2_error_message is not None:
            if not can_fallback_to_v1:
                _log_v2_fallback_blocked(
                    "v2_plan_or_bridge_error",
                    detail=f"{v2_error_message}: fallback denied by policy",
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {v2_error_message} (fallback_policy={fallback_policy_mode})",
                )
            _log_v2_fallback("v2_plan_or_bridge_error", detail=v2_error_message)
            return _parse_with_v1_or_422(payload.command)
    else:
        return _parse_with_v1_or_422(payload.command)
    return tasks
