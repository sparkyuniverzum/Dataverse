from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.domains.auth.queries import (
    AuthContextResult,
    AuthQueryError,
    get_user_from_context,
    resolve_auth_context,
)
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

AuthContext = AuthContextResult


async def get_current_auth_context(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    try:
        return await resolve_auth_context(
            token=token,
            session=session,
        )
    except AuthQueryError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=exc.headers) from exc


async def get_current_user(context: AuthContext = Depends(get_current_auth_context)) -> User:
    return get_user_from_context(context=context)
