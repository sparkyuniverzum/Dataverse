from __future__ import annotations

import csv
import hashlib
import io
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ImportError, ImportJob
from app.services.parser_service import AtomicTask
from app.services.task_executor_service import TaskExecutorService
from app.services.universe_service import UniverseService


class ImportMode(StrEnum):
    PREVIEW = "preview"
    COMMIT = "commit"


class ImportStatus(StrEnum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"


@dataclass
class ImportExecutionResult:
    job: ImportJob
    summary: dict[str, Any]


@dataclass
class ImportRowFailure:
    code: str
    message: str
    details: dict[str, Any]


class ImportErrorRow(BaseModel):
    row_number: int
    column_name: str | None = None
    code: str
    message: str
    raw_value: str | None = None


RESERVED_COLUMNS = {
    "value",
    "source",
    "target",
    "source_id",
    "target_id",
    "bond_type",
    "type",
}


class ImportExportService:
    def __init__(
        self,
        *,
        task_executor: TaskExecutorService,
        universe_service: UniverseService,
    ) -> None:
        self.task_executor = task_executor
        self.universe_service = universe_service

    @staticmethod
    def _decode_csv_bytes(file_bytes: bytes) -> str:
        try:
            return file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="CSV must be UTF-8 encoded",
            ) from exc

    @staticmethod
    def _normalize_row(raw_row: dict[str, Any]) -> dict[str, str]:
        row: dict[str, str] = {}
        for key, value in raw_row.items():
            normalized_key = str(key or "").strip()
            if not normalized_key:
                continue
            normalized_value = str(value or "").strip()
            row[normalized_key] = normalized_value
        return row

    @staticmethod
    def _metadata_from_row(row: dict[str, str]) -> dict[str, str]:
        metadata: dict[str, str] = {}
        for key, value in row.items():
            if key in RESERVED_COLUMNS:
                continue
            if not value:
                continue
            metadata[key] = value
        return metadata

    @staticmethod
    def _parse_uuid(value: str) -> UUID:
        try:
            return UUID(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid UUID: {value}") from exc

    @classmethod
    def _tasks_from_csv_row(cls, row: dict[str, str]) -> list[AtomicTask]:
        if not any(row.values()):
            return []

        source_id = row.get("source_id")
        target_id = row.get("target_id")
        source = row.get("source")
        target = row.get("target")
        bond_type = row.get("bond_type") or row.get("type") or "RELATION"

        if source_id or target_id or source or target:
            if source_id and target_id:
                source_uuid = cls._parse_uuid(source_id)
                target_uuid = cls._parse_uuid(target_id)
                return [
                    AtomicTask(
                        action="LINK",
                        params={
                            "source_id": str(source_uuid),
                            "target_id": str(target_uuid),
                            "type": bond_type,
                        },
                    )
                ]

            if source and target:
                return [
                    AtomicTask(action="INGEST", params={"value": source, "metadata": {}}),
                    AtomicTask(action="INGEST", params={"value": target, "metadata": {}}),
                    AtomicTask(action="LINK", params={"type": bond_type}),
                ]

            raise ValueError("Row defines partial bond columns; provide source+target or source_id+target_id")

        value = row.get("value")
        if not value:
            raise ValueError("Row requires 'value' column")

        return [
            AtomicTask(
                action="INGEST",
                params={
                    "value": value,
                    "metadata": cls._metadata_from_row(row),
                },
            )
        ]

    @staticmethod
    def _classify_row_failure(exc: Exception) -> ImportRowFailure:
        if isinstance(exc, ValueError):
            return ImportRowFailure(
                code="ROW_INPUT_INVALID",
                message=str(exc),
                details={"kind": "value_error"},
            )

        if isinstance(exc, HTTPException):
            detail = exc.detail
            http_status = int(exc.status_code)
            detail_dict = detail if isinstance(detail, dict) else {}
            detail_message = (
                str(detail_dict.get("message")).strip()
                if isinstance(detail_dict.get("message"), str)
                else str(detail).strip()
            )
            normalized = detail_message.lower()

            if http_status == status.HTTP_404_NOT_FOUND:
                code = "ROW_TARGET_NOT_FOUND"
            elif http_status == status.HTTP_409_CONFLICT:
                code = str(detail_dict.get("code") or "ROW_CONFLICT").strip() or "ROW_CONFLICT"
            elif http_status == status.HTTP_422_UNPROCESSABLE_CONTENT:
                code = "ROW_CONTRACT_VIOLATION" if "table contract violation" in normalized else "ROW_DOMAIN_VALIDATION"
            elif http_status >= 500:
                code = "ROW_INTERNAL_ERROR"
            else:
                code = f"ROW_HTTP_{http_status}"

            return ImportRowFailure(
                code=code,
                message=detail_message or "Row execution failed",
                details={"kind": "http_error", "http_status": http_status, "detail": detail},
            )

        return ImportRowFailure(
            code="ROW_UNEXPECTED_ERROR",
            message=str(exc) or exc.__class__.__name__,
            details={"kind": "unexpected_error", "error_type": exc.__class__.__name__},
        )

    @staticmethod
    def _serialize_row_error_payload(*, row: dict[str, str], failure: ImportRowFailure) -> str:
        return json.dumps(
            {
                "row": row,
                "error": {
                    "code": failure.code,
                    "message": failure.message,
                    "details": failure.details,
                },
            },
            ensure_ascii=False,
            sort_keys=True,
        )

    @staticmethod
    def _build_job_summary(
        *,
        strict: bool,
        planned_tasks: int,
        mode: ImportMode,
        branch_id: UUID | None,
        failure_row: int | None = None,
    ) -> dict[str, Any]:
        summary: dict[str, Any] = {
            "strict": strict,
            "planned_tasks": planned_tasks,
            "mode": mode.value,
            "branch_id": str(branch_id) if branch_id is not None else None,
        }
        if failure_row is not None:
            summary["failure_row"] = int(failure_row)
        return summary

    async def _record_import_row_failure(
        self,
        *,
        session: AsyncSession,
        in_tx: Any,
        job_id: UUID,
        row_number: int,
        row: dict[str, str],
        failure: ImportRowFailure,
    ) -> None:
        async with in_tx():
            session.add(
                ImportError(
                    job_id=job_id,
                    row_number=row_number,
                    code=failure.code,
                    message=failure.message,
                    raw_value=self._serialize_row_error_payload(row=row, failure=failure),
                )
            )

    async def _finalize_import_failed(
        self,
        *,
        session: AsyncSession,
        in_tx: Any,
        job: ImportJob,
        total_rows: int,
        processed_rows: int,
        errors_count: int,
        strict: bool,
        planned_tasks: int,
        mode: ImportMode,
        branch_id: UUID | None,
        failure_row: int,
    ) -> ImportExecutionResult:
        async with in_tx():
            job.status = ImportStatus.FAILED.value
            job.total_rows = total_rows
            job.processed_rows = processed_rows
            job.errors_count = errors_count
            job.finished_at = datetime.now(UTC)
            job.summary = self._build_job_summary(
                strict=strict,
                planned_tasks=planned_tasks,
                mode=mode,
                branch_id=branch_id,
                failure_row=failure_row,
            )
        await session.refresh(job)
        return ImportExecutionResult(job=job, summary=job.summary)

    async def _create_import_job(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        filename: str,
        file_hash: str,
        mode: ImportMode,
        strict: bool,
    ) -> ImportJob:
        job = ImportJob(
            user_id=user_id,
            galaxy_id=galaxy_id,
            filename=filename,
            file_hash=file_hash,
            mode=mode.value,
            status=ImportStatus.RUNNING.value,
            total_rows=0,
            processed_rows=0,
            errors_count=0,
            summary={"strict": strict},
        )
        session.add(job)
        await session.flush()
        await session.refresh(job)
        return job

    async def get_job_for_user(self, session: AsyncSession, *, user_id: UUID, job_id: UUID) -> ImportJob:
        job = (
            await session.execute(
                select(ImportJob).where(
                    and_(
                        ImportJob.id == job_id,
                        ImportJob.user_id == user_id,
                        ImportJob.deleted_at.is_(None),
                    )
                )
            )
        ).scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")
        return job

    async def get_job_errors(self, session: AsyncSession, *, user_id: UUID, job_id: UUID) -> list[ImportError]:
        _ = await self.get_job_for_user(session=session, user_id=user_id, job_id=job_id)
        return list(
            (
                await session.execute(
                    select(ImportError)
                    .join(ImportJob, ImportJob.id == ImportError.job_id)
                    .where(
                        and_(
                            ImportError.job_id == job_id,
                            ImportJob.user_id == user_id,
                            ImportJob.deleted_at.is_(None),
                        )
                    )
                    .order_by(ImportError.row_number.asc(), ImportError.id.asc())
                )
            )
            .scalars()
            .all()
        )

    async def import_csv(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        filename: str,
        file_bytes: bytes,
        mode: ImportMode,
        strict: bool,
    ) -> ImportExecutionResult:
        @asynccontextmanager
        async def in_tx():
            if session.in_transaction():
                async with session.begin_nested():
                    yield
            else:
                async with session.begin():
                    yield

        decoded = self._decode_csv_bytes(file_bytes)
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        job = await self._create_import_job(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            filename=filename or "import.csv",
            file_hash=file_hash,
            mode=mode,
            strict=strict,
        )
        await session.refresh(job)

        stream = io.StringIO(decoded)
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="CSV must include a header row"
            )

        total_rows = 0
        processed_rows = 0
        errors_count = 0
        planned_tasks = 0

        for row_number, raw_row in enumerate(reader, start=2):
            total_rows += 1
            row = self._normalize_row(raw_row)
            try:
                tasks = self._tasks_from_csv_row(row)
                if not tasks:
                    continue
                planned_tasks += len(tasks)

                if mode == ImportMode.COMMIT:
                    # Row-level transaction keeps strong consistency and lets lenient mode continue.
                    async with in_tx():
                        await self.task_executor.execute_tasks(
                            session=session,
                            tasks=tasks,
                            user_id=user_id,
                            galaxy_id=galaxy_id,
                            branch_id=branch_id,
                            manage_transaction=False,
                        )
                processed_rows += 1
            except RuntimeError:
                raise
            except Exception as exc:
                failure = self._classify_row_failure(exc)
                errors_count += 1
                await self._record_import_row_failure(
                    session=session,
                    in_tx=in_tx,
                    job_id=job.id,
                    row_number=row_number,
                    row=row,
                    failure=failure,
                )
                if strict:
                    return await self._finalize_import_failed(
                        session=session,
                        in_tx=in_tx,
                        job=job,
                        total_rows=total_rows,
                        processed_rows=processed_rows,
                        errors_count=errors_count,
                        strict=strict,
                        planned_tasks=planned_tasks,
                        mode=mode,
                        branch_id=branch_id,
                        failure_row=row_number,
                    )

        final_status = ImportStatus.COMPLETED.value
        if errors_count > 0:
            final_status = ImportStatus.COMPLETED_WITH_ERRORS.value

        async with in_tx():
            job.status = final_status
            job.total_rows = total_rows
            job.processed_rows = processed_rows
            job.errors_count = errors_count
            job.finished_at = datetime.now(UTC)
            job.summary = self._build_job_summary(
                strict=strict,
                planned_tasks=planned_tasks,
                mode=mode,
                branch_id=branch_id,
            )
        await session.refresh(job)

        return ImportExecutionResult(job=job, summary=job.summary)

    async def export_snapshot_csv(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        as_of: datetime | None,
    ) -> str:
        asteroids, bonds = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "record_type",
                "id",
                "value",
                "metadata",
                "calculated_values",
                "active_alerts",
                "created_at",
                "source_id",
                "target_id",
                "bond_type",
            ]
        )

        for asteroid in asteroids:
            if isinstance(asteroid, dict):
                asteroid_id = asteroid.get("id")
                value = asteroid.get("value")
                metadata = asteroid.get("metadata", {})
                calculated_values = asteroid.get("calculated_values", {})
                alerts = asteroid.get("active_alerts", [])
                created_at = asteroid.get("created_at")
            else:
                asteroid_id = asteroid.id
                value = asteroid.value
                metadata = asteroid.metadata
                calculated_values = {}
                alerts = []
                created_at = asteroid.created_at
            writer.writerow(
                [
                    "asteroid",
                    str(asteroid_id),
                    value,
                    json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                    json.dumps(calculated_values, ensure_ascii=False, sort_keys=True),
                    json.dumps(alerts, ensure_ascii=False),
                    created_at.isoformat() if isinstance(created_at, datetime) else "",
                    "",
                    "",
                    "",
                ]
            )

        for bond in bonds:
            writer.writerow(
                [
                    "bond",
                    str(bond.id),
                    "",
                    "",
                    "",
                    "",
                    bond.created_at.isoformat(),
                    str(bond.source_id),
                    str(bond.target_id),
                    bond.type,
                ]
            )

        return output.getvalue()

    async def export_tables_csv(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        as_of: datetime | None,
    ) -> str:
        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "table_id",
                "table_name",
                "schema_fields",
                "formula_fields",
                "member_id",
                "member_value",
                "member_created_at",
                "sector_mode",
                "sector_center",
                "sector_size",
            ]
        )

        for table in tables:
            members = table.get("members", [])
            if not members:
                writer.writerow(
                    [
                        str(table.get("table_id")),
                        table.get("name", ""),
                        json.dumps(table.get("schema_fields", []), ensure_ascii=False),
                        json.dumps(table.get("formula_fields", []), ensure_ascii=False),
                        "",
                        "",
                        "",
                        table.get("sector", {}).get("mode", ""),
                        json.dumps(table.get("sector", {}).get("center", []), ensure_ascii=False),
                        table.get("sector", {}).get("size", ""),
                    ]
                )
                continue

            for member in members:
                created_at = member.get("created_at")
                writer.writerow(
                    [
                        str(table.get("table_id")),
                        table.get("name", ""),
                        json.dumps(table.get("schema_fields", []), ensure_ascii=False),
                        json.dumps(table.get("formula_fields", []), ensure_ascii=False),
                        str(member.get("id", "")),
                        member.get("value", ""),
                        created_at.isoformat() if isinstance(created_at, datetime) else "",
                        table.get("sector", {}).get("mode", ""),
                        json.dumps(table.get("sector", {}).get("center", []), ensure_ascii=False),
                        table.get("sector", {}).get("size", ""),
                    ]
                )

        return output.getvalue()
