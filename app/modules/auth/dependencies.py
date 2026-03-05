from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AuthSession, User
from app.modules.auth.errors import invalid_token_error, missing_session_error
from app.modules.auth.repository import AuthRepository
from app.modules.auth.security import TokenClaims, decode_token_safe, utc_now

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass(frozen=True)
class AuthContext:
    user: User
    auth_session: AuthSession
    claims: TokenClaims


async def get_current_auth_context(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    claims = decode_token_safe(token, expected_type="access")
    repository = AuthRepository()

    auth_session = await repository.get_auth_session(session=session, session_id=claims.session_id)
    if auth_session is None:
        raise missing_session_error()
    if auth_session.user_id != claims.user_id:
        raise missing_session_error()
    if auth_session.revoked_at is not None:
        raise missing_session_error()
    if auth_session.access_expires_at.astimezone(timezone.utc) <= utc_now():
        raise missing_session_error()
    if auth_session.refresh_expires_at.astimezone(timezone.utc) <= utc_now():
        raise missing_session_error()

    user = await repository.get_user_by_id(session=session, user_id=claims.user_id)
    if user is None or not user.is_active:
        raise invalid_token_error()

    return AuthContext(user=user, auth_session=auth_session, claims=claims)


async def get_current_user(context: AuthContext = Depends(get_current_auth_context)) -> User:
    return context.user
