from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class SharedQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


class SharedQueryNotFoundError(SharedQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=404, detail=detail)


class SharedQueryConflictError(SharedQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=409, detail=detail)


class SharedQueryForbiddenError(SharedQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=403, detail=detail)


def _map_service_exception(exc: Exception) -> SharedQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    status_code = int(status_code_raw)
    if status_code == 404:
        return SharedQueryNotFoundError(detail)
    if status_code == 409:
        return SharedQueryConflictError(detail)
    if status_code == 403:
        return SharedQueryForbiddenError(detail)
    return SharedQueryError(status_code=status_code, detail=detail)


async def latest_event_seq(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> int:
    try:
        return await services.event_store.latest_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def list_events_after(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    after_event_seq: int,
    limit: int,
) -> list[Any]:
    try:
        rows = await services.event_store.list_events_after(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            after_event_seq=after_event_seq,
            limit=limit,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


async def list_events(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    as_of: datetime | None,
    up_to_event_seq: int | None,
) -> list[Any]:
    try:
        rows = await services.event_store.list_events(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=as_of,
            up_to_event_seq=up_to_event_seq,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


async def list_outbox_events(
    *,
    session: AsyncSession,
    services: Any,
    status: str | None,
    event_type: str | None,
    as_of: datetime | None,
    limit: int,
) -> list[Any]:
    try:
        rows = await services.event_store.list_outbox_events(
            session=session,
            status=status,
            event_type=event_type,
            as_of=as_of,
            limit=limit,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


__all__ = [
    "SharedQueryConflictError",
    "SharedQueryError",
    "SharedQueryForbiddenError",
    "SharedQueryNotFoundError",
    "latest_event_seq",
    "list_events",
    "list_events_after",
    "list_outbox_events",
]
