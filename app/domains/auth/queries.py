from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.security.auth_security import TokenClaims, decode_token_safe, utc_now
from app.models import AuthSession, User
from app.modules.auth.repository import AuthRepository


class AuthQueryError(Exception):
    def __init__(self, *, status_code: int, detail: Any, headers: dict[str, str] | None = None) -> None:
        super().__init__(str(detail))
        self.status_code = int(status_code)
        self.detail = detail
        self.headers = dict(headers or {})


@dataclass(frozen=True)
class AuthContextResult:
    user: User
    auth_session: AuthSession
    claims: TokenClaims


def _map_exception(exc: Exception) -> AuthQueryError | None:
    status_code_raw = getattr(exc, "status_code", None)
    detail = getattr(exc, "detail", str(exc))
    headers_raw = getattr(exc, "headers", None)
    if not isinstance(status_code_raw, int):
        return None
    headers = headers_raw if isinstance(headers_raw, dict) else None
    return AuthQueryError(status_code=int(status_code_raw), detail=detail, headers=headers)


def _session_error() -> AuthQueryError:
    return AuthQueryError(
        status_code=401,
        detail="Session is invalid or expired",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _token_error() -> AuthQueryError:
    return AuthQueryError(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_access_token(*, token: str) -> TokenClaims:
    try:
        return decode_token_safe(token, expected_type="access")
    except Exception as exc:
        mapped = _map_exception(exc)
        if mapped is None:
            raise
        raise mapped from exc


async def resolve_auth_context(
    *,
    token: str,
    session: AsyncSession,
    repository: AuthRepository | None = None,
) -> AuthContextResult:
    claims = decode_access_token(token=token)
    repo = repository or AuthRepository()

    auth_session = await repo.get_auth_session(session=session, session_id=claims.session_id)
    if auth_session is None:
        raise _session_error()
    if auth_session.user_id != claims.user_id:
        raise _session_error()
    if auth_session.revoked_at is not None:
        raise _session_error()
    if auth_session.access_expires_at.astimezone(UTC) <= utc_now():
        raise _session_error()
    if auth_session.refresh_expires_at.astimezone(UTC) <= utc_now():
        raise _session_error()

    user = await repo.get_user_by_id(session=session, user_id=claims.user_id)
    if user is None or not user.is_active:
        raise _token_error()

    return AuthContextResult(user=user, auth_session=auth_session, claims=claims)


def get_user_from_context(*, context: AuthContextResult) -> User:
    return context.user


__all__ = [
    "AuthContextResult",
    "AuthQueryError",
    "decode_access_token",
    "get_user_from_context",
    "resolve_auth_context",
]
