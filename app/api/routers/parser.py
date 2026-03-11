from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import execution_to_response
from app.api.runtime import (
    get_service_container,
    resolve_branch_id_for_user,
    resolve_galaxy_id_for_user,
    run_scoped_atomic_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.infrastructure.runtime.parser.command_service import ScopedContext, resolve_tasks_for_payload
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import ParseCommandPlanResponse, ParseCommandRequest, ParseCommandResponse

router = APIRouter(tags=["parser"])


@router.post("/parser/plan", response_model=ParseCommandPlanResponse, status_code=status.HTTP_200_OK)
async def parse_only(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandPlanResponse:
    def _normalize_plan_tasks(raw_tasks):
        normalized = []
        for task in list(raw_tasks or []):
            if isinstance(task, dict):
                normalized.append(task)
                continue
            action = getattr(task, "action", None)
            params = getattr(task, "params", None)
            source_text = getattr(task, "source_text", "")
            if action is not None:
                normalized.append(
                    {
                        "action": str(action),
                        "params": params if isinstance(params, dict) else {},
                        "source_text": str(source_text or ""),
                    }
                )
        return normalized

    scoped_context = ScopedContext()

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        if scoped_context.galaxy_id is None:
            scoped_context.galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            scoped_context.branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=scoped_context.galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return scoped_context.galaxy_id, scoped_context.branch_id

    tasks = await resolve_tasks_for_payload(
        payload=payload,
        session=session,
        current_user_id=current_user.id,
        services=services,
        ensure_scope=ensure_scope,
    )
    return ParseCommandPlanResponse(tasks=_normalize_plan_tasks(tasks), parser_version=payload.parser_version)


@router.post("/parser/execute", response_model=ParseCommandResponse, status_code=status.HTTP_200_OK)
async def parse_and_execute(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandResponse:
    scoped_context = ScopedContext()

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        if scoped_context.galaxy_id is None:
            scoped_context.galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            scoped_context.branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=scoped_context.galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return scoped_context.galaxy_id, scoped_context.branch_id

    tasks = await resolve_tasks_for_payload(
        payload=payload,
        session=session,
        current_user_id=current_user.id,
        services=services,
        ensure_scope=ensure_scope,
    )

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/parser/execute",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "command": payload.command,
            "parser_version": payload.parser_version,
        },
        map_execution=lambda execution: execution_to_response(tasks=tasks, execution=execution),
        replay_loader=ParseCommandResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Parser execution failed",
        resolved_scope=scoped_context.resolved_scope,
    )
