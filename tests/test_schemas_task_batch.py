from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import TaskBatchExecuteRequest


def test_task_batch_request_defaults_to_commit_mode() -> None:
    payload = TaskBatchExecuteRequest(tasks=[{"action": "UPDATE_ASTEROID", "params": {"asteroid_id": "x"}}])
    assert payload.mode == "commit"


def test_task_batch_request_normalizes_preview_mode() -> None:
    payload = TaskBatchExecuteRequest(
        mode="Preview",
        tasks=[{"action": "INGEST", "params": {"value": "A", "metadata": {}}}],
    )
    assert payload.mode == "preview"


def test_task_batch_request_rejects_empty_tasks() -> None:
    with pytest.raises(ValidationError):
        TaskBatchExecuteRequest(tasks=[])


def test_task_batch_request_rejects_unknown_mode() -> None:
    with pytest.raises(ValidationError):
        TaskBatchExecuteRequest(
            mode="dry-run",
            tasks=[{"action": "INGEST", "params": {"value": "A", "metadata": {}}}],
        )
