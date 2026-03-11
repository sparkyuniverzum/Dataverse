from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class ImportCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class ImportCommandPlan:
    request_payload: dict[str, Any]


_ALLOWED_IMPORT_MODES = {"preview", "commit"}


def _map_service_exception(exc: Exception) -> ImportCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return ImportCommandError(status_code=int(status_code_raw), detail=detail)


def ensure_csv_filename(filename: str | None) -> str:
    normalized = str(filename or "").strip()
    if not normalized:
        raise ImportCommandError(status_code=422, detail="Missing filename")
    if not normalized.lower().endswith(".csv"):
        raise ImportCommandError(status_code=422, detail="Phase 1 import supports CSV only")
    return normalized


def ensure_non_empty_payload(file_bytes: bytes) -> bytes:
    if not isinstance(file_bytes, bytes) or not file_bytes:
        raise ImportCommandError(status_code=422, detail="Uploaded file is empty")
    return file_bytes


def ensure_csv_export_format(format_value: str) -> str:
    normalized = str(format_value or "").strip().lower()
    if normalized != "csv":
        raise ImportCommandError(status_code=422, detail="Phase 1 export supports CSV only")
    return normalized


def ensure_import_mode(mode_value: str) -> str:
    normalized = str(mode_value or "commit").strip().lower()
    if normalized not in _ALLOWED_IMPORT_MODES:
        raise ImportCommandError(status_code=422, detail="Unsupported import mode")
    return normalized


def plan_import_csv(
    *,
    filename: str,
    mode: str,
    strict: bool,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
) -> ImportCommandPlan:
    return ImportCommandPlan(
        request_payload={
            "filename": ensure_csv_filename(filename),
            "mode": ensure_import_mode(mode),
            "strict": bool(strict),
            "galaxy_id": str(galaxy_id) if galaxy_id is not None else None,
            "branch_id": str(branch_id) if branch_id is not None else None,
        }
    )


async def run_import_csv(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    filename: str,
    file_bytes: bytes,
    mode: str,
    strict: bool,
) -> Any:
    try:
        return await services.io_service.import_csv(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            filename=filename,
            file_bytes=file_bytes,
            mode=ensure_import_mode(mode),
            strict=bool(strict),
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "ImportCommandError",
    "ImportCommandPlan",
    "ensure_csv_export_format",
    "ensure_csv_filename",
    "ensure_import_mode",
    "ensure_non_empty_payload",
    "plan_import_csv",
    "run_import_csv",
]
