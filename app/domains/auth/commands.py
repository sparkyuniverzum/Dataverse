from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class AuthCommandError(Exception):
    def __init__(self, *, status_code: int, detail: Any, headers: dict[str, str] | None = None) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail
        self.headers = dict(headers or {})


@dataclass(frozen=True)
class AuthCommandPlan:
    request_payload: dict[str, Any]


def _map_service_exception(exc: Exception) -> AuthCommandError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    headers_raw = getattr(exc, "headers", None)
    if not isinstance(status_code_raw, int):
        return None
    headers = headers_raw if isinstance(headers_raw, dict) else None
    return AuthCommandError(status_code=int(status_code_raw), detail=detail, headers=headers)


def plan_register(*, email: str, password: str, galaxy_name: str | None) -> AuthCommandPlan:
    return AuthCommandPlan(
        request_payload={
            "email": str(email),
            "password": str(password),
            "galaxy_name": str(galaxy_name) if galaxy_name is not None else None,
        }
    )


def plan_login(*, email: str, password: str) -> AuthCommandPlan:
    return AuthCommandPlan(
        request_payload={
            "email": str(email),
            "password": str(password),
        }
    )


def plan_refresh(*, refresh_token: str) -> AuthCommandPlan:
    return AuthCommandPlan(request_payload={"refresh_token": str(refresh_token)})


def plan_logout(*, session_id: UUID, reason: str = "logout") -> AuthCommandPlan:
    return AuthCommandPlan(
        request_payload={
            "session_id": str(session_id),
            "reason": str(reason),
        }
    )


async def register(
    *,
    session: AsyncSession,
    services: Any,
    email: str,
    password: str,
    galaxy_name: str | None,
    user_agent: str | None,
    ip_address: str | None,
) -> Any:
    try:
        return await services.auth_service.register(
            session=session,
            email=email,
            password=password,
            galaxy_name=galaxy_name,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def login(
    *,
    session: AsyncSession,
    services: Any,
    email: str,
    password: str,
    user_agent: str | None,
    ip_address: str | None,
) -> Any:
    try:
        return await services.auth_service.login(
            session=session,
            email=email,
            password=password,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def refresh_tokens(
    *,
    session: AsyncSession,
    services: Any,
    refresh_token: str,
) -> Any:
    try:
        return await services.auth_service.refresh_tokens(
            session=session,
            refresh_token=refresh_token,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def revoke_session(
    *,
    session: AsyncSession,
    services: Any,
    session_id: UUID,
    reason: str = "logout",
) -> None:
    try:
        await services.auth_service.revoke_session(
            session=session,
            session_id=session_id,
            reason=reason,
        )
    except Exception as exc:
        mapped = _map_service_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


__all__ = [
    "AuthCommandError",
    "AuthCommandPlan",
    "login",
    "plan_login",
    "plan_logout",
    "plan_refresh",
    "plan_register",
    "refresh_tokens",
    "register",
    "revoke_session",
]
