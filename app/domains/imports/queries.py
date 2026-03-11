from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class ImportQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


class ImportQueryNotFoundError(ImportQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=404, detail=detail)


class ImportQueryConflictError(ImportQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=409, detail=detail)


class ImportQueryForbiddenError(ImportQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=403, detail=detail)


def _map_service_exception(exc: Exception) -> ImportQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    status_code = int(status_code_raw)
    if status_code == 404:
        return ImportQueryNotFoundError(detail)
    if status_code == 409:
        return ImportQueryConflictError(detail)
    if status_code == 403:
        return ImportQueryForbiddenError(detail)
    return ImportQueryError(status_code=status_code, detail=detail)


async def get_job_for_user(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    job_id: UUID,
) -> Any:
    try:
        return await services.io_service.get_job_for_user(
            session=session,
            user_id=user_id,
            job_id=job_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def get_job_errors(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    job_id: UUID,
) -> list[Any]:
    try:
        rows = await services.io_service.get_job_errors(
            session=session,
            user_id=user_id,
            job_id=job_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


async def export_snapshot_csv(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    as_of: datetime | None,
) -> str:
    try:
        return await services.io_service.export_snapshot_csv(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def export_tables_csv(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    as_of: datetime | None,
) -> str:
    try:
        return await services.io_service.export_tables_csv(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "ImportQueryConflictError",
    "ImportQueryError",
    "ImportQueryForbiddenError",
    "ImportQueryNotFoundError",
    "export_snapshot_csv",
    "export_tables_csv",
    "get_job_errors",
    "get_job_for_user",
]
