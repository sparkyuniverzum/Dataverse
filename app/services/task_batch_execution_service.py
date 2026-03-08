from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.parser_service import AtomicTask
from app.services.task_executor_service import TaskExecutionResult


def _transactional_context(session: AsyncSession):
    return session.begin_nested() if session.in_transaction() else session.begin()


async def execute_atomic_tasks_preview(
    *,
    session: AsyncSession,
    services,
    tasks: Sequence[AtomicTask],
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> TaskExecutionResult:
    async with _transactional_context(session):
        async with session.begin_nested() as preview_tx:
            execution = await services.task_executor_service.execute_tasks(
                session=session,
                tasks=list(tasks),
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                manage_transaction=False,
            )
            await preview_tx.rollback()
    return execution
