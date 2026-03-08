from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import execution_to_response, task_to_response
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_atomic_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import TaskBatchExecuteRequest, TaskBatchExecuteResponse
from app.services.parser_service import AtomicTask
from app.services.task_batch_execution_service import execute_atomic_tasks_preview

router = APIRouter(tags=["tasks"])


@router.post("/tasks/execute-batch", response_model=TaskBatchExecuteResponse, status_code=status.HTTP_200_OK)
async def execute_task_batch(
    payload: TaskBatchExecuteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> TaskBatchExecuteResponse:
    tasks = [AtomicTask(action=task.action, params=dict(task.params or {})) for task in payload.tasks]
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    resolved_galaxy_id, resolved_branch_id = resolved_scope

    if payload.mode == "preview":
        execution = await execute_atomic_tasks_preview(
            session=session,
            services=services,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            branch_id=resolved_branch_id,
        )
        result = execution_to_response(tasks=tasks, execution=execution)
        return TaskBatchExecuteResponse(mode="preview", task_count=len(tasks), result=result)

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/tasks/execute-batch",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "mode": payload.mode,
            "tasks": [task_to_response(task).model_dump(mode="json") for task in tasks],
        },
        map_execution=lambda execution: TaskBatchExecuteResponse(
            mode="commit",
            task_count=len(tasks),
            result=execution_to_response(tasks=tasks, execution=execution),
        ),
        replay_loader=TaskBatchExecuteResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Batch execution failed",
        resolved_scope=resolved_scope,
    )
