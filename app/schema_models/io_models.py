from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ImportModeSchema(StrEnum):
    preview = "preview"
    commit = "commit"


class ImportStatusSchema(StrEnum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"


class ImportJobPublic(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    galaxy_id: uuid.UUID
    filename: str
    file_hash: str
    mode: str
    status: ImportStatusSchema
    total_rows: int
    processed_rows: int
    errors_count: int
    summary: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    finished_at: datetime | None


class ImportErrorPublic(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    row_number: int
    column_name: str | None
    code: str
    message: str
    raw_value: str | None
    created_at: datetime


class ImportRunResponse(BaseModel):
    job: ImportJobPublic


class ImportErrorsResponse(BaseModel):
    errors: list[ImportErrorPublic] = Field(default_factory=list)
