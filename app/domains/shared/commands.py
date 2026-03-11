from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.event_envelope import DomainEventEnvelope


class SharedCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class SharedCommandPlan:
    request_payload: dict[str, Any]


def _map_service_exception(exc: Exception) -> SharedCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    if not isinstance(status_code_raw, int):
        return None
    return SharedCommandError(status_code=int(status_code_raw), detail=detail)


def build_idempotency_request_hash(*, services: Any, request_payload: dict[str, Any]) -> str:
    try:
        return services.idempotency_service.request_hash(request_payload)
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def check_idempotency_replay(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
) -> Any:
    try:
        return await services.idempotency_service.check_replay(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def store_idempotency_response(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
    status_code: int,
    response_payload: dict[str, Any],
) -> None:
    try:
        await services.idempotency_service.store_response(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            status_code=status_code,
            response_payload=response_payload,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def append_event(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    entity_id: UUID,
    event_type: str,
    payload: dict[str, Any],
) -> Any:
    try:
        return await services.event_store.append_event(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
            event_type=event_type,
            payload=payload,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def append_outbox_event(
    *,
    session: AsyncSession,
    services: Any,
    envelope: DomainEventEnvelope,
    available_at: datetime | None = None,
) -> Any:
    try:
        return await services.event_store.append_outbox_event(
            session=session,
            envelope=envelope,
            available_at=available_at,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "SharedCommandError",
    "SharedCommandPlan",
    "append_event",
    "append_outbox_event",
    "build_idempotency_request_hash",
    "check_idempotency_replay",
    "store_idempotency_response",
]
