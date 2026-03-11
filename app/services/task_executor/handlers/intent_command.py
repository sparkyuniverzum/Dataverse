from __future__ import annotations

from typing import TYPE_CHECKING

from app.services.parser_types import AtomicTask
from app.services.task_executor.intent_commands import IntentCommand

if TYPE_CHECKING:
    from app.services.task_executor.service import TaskExecutorService, _TaskExecutionContext


class IntentCommandHandler:
    def __init__(self, service: TaskExecutorService):
        self.service = service

    async def handle(self, *, task: object, ctx: _TaskExecutionContext) -> bool:
        if not isinstance(task, IntentCommand):
            return False
        atomic_task = AtomicTask(action=task.action, params=dict(task.params))
        for handler in self.service.atomic_family_handlers:
            if await handler(task=atomic_task, ctx=ctx):
                return True
        return False
