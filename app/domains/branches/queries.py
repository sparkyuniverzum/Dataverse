from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class BranchQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


class BranchQueryNotFoundError(BranchQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=404, detail=detail)


class BranchQueryConflictError(BranchQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=409, detail=detail)


class BranchQueryForbiddenError(BranchQueryError):
    def __init__(self, detail: Any) -> None:
        super().__init__(status_code=403, detail=detail)


def _map_service_exception(exc: Exception) -> BranchQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    status_code = int(status_code_raw)
    if status_code == 404:
        return BranchQueryNotFoundError(detail)
    if status_code == 409:
        return BranchQueryConflictError(detail)
    if status_code == 403:
        return BranchQueryForbiddenError(detail)
    return BranchQueryError(status_code=status_code, detail=detail)


async def list_branches(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID | None,
) -> list[Any]:
    try:
        rows = await services.cosmos_service.list_branches(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc
    return list(rows)


__all__ = [
    "BranchQueryConflictError",
    "BranchQueryError",
    "BranchQueryForbiddenError",
    "BranchQueryNotFoundError",
    "list_branches",
]
