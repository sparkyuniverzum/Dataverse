from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import execution_to_response
from app.api.runtime import (
    get_service_container,
    resolve_branch_id_for_user,
    resolve_galaxy_id_for_user,
    run_scoped_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import ParseCommandPlanResponse, ParseCommandRequest, ParseCommandResponse
from app.services.parser2 import Parser2SemanticPlanner, SnapshotSemanticResolver, parser_v2_fallback_to_v1_enabled
from app.services.parser_service import AtomicTask

router = APIRouter(tags=["parser"])


async def _resolve_tasks_for_payload(
    *,
    payload: ParseCommandRequest,
    session: AsyncSession,
    current_user: User,
    services: ServiceContainer,
    ensure_scope,
) -> list[AtomicTask]:
    tasks: list[AtomicTask]
    parser_version_explicit = "parser_version" in payload.model_fields_set
    if payload.parser_version == "v2":
        v2_error_message: str | None = None
        scoped_galaxy_id, scoped_branch_id = await ensure_scope()
        active_asteroids, _ = await services.universe_service.project_state(
            session=session,
            user_id=current_user.id,
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
    else:
        parse_result = services.parser_service.parse_with_diagnostics(payload.command)
        if parse_result.errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Parse error: {parse_result.errors[0]}",
            )
        tasks = parse_result.tasks
    return tasks


@router.post("/parser/plan", response_model=ParseCommandPlanResponse, status_code=status.HTTP_200_OK)
async def parse_only(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandPlanResponse:
    target_galaxy_id: UUID | None = None
    target_branch_id: UUID | None = None

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        nonlocal target_galaxy_id, target_branch_id
        if target_galaxy_id is None:
            target_galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            target_branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=target_galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return target_galaxy_id, target_branch_id

    tasks = await _resolve_tasks_for_payload(
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
        ensure_scope=ensure_scope,
    )
    return ParseCommandPlanResponse(tasks=tasks, parser_version=payload.parser_version)


@router.post("/parser/execute", response_model=ParseCommandResponse, status_code=status.HTTP_200_OK)
async def parse_and_execute(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandResponse:
    target_galaxy_id: UUID | None = None
    target_branch_id: UUID | None = None

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        nonlocal target_galaxy_id, target_branch_id
        if target_galaxy_id is None:
            target_galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            target_branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=target_galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return target_galaxy_id, target_branch_id

    tasks = await _resolve_tasks_for_payload(
        payload=payload,
        session=session,
        current_user=current_user,
        services=services,
        ensure_scope=ensure_scope,
    )

    resolved_scope: tuple[UUID, UUID | None] | None = None
    if target_galaxy_id is not None:
        resolved_scope = (target_galaxy_id, target_branch_id)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> ParseCommandResponse:
        execution = await services.task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        return execution_to_response(tasks=tasks, execution=execution)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/parser/execute",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "command": payload.command,
            "parser_version": payload.parser_version,
        },
        execute=execute_scoped,
        replay_loader=ParseCommandResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Parser execution failed",
        resolved_scope=resolved_scope,
    )
