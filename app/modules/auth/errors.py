from __future__ import annotations

from fastapi import HTTPException, status


def invalid_credentials_error() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


def invalid_token_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def missing_session_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session is invalid or expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
