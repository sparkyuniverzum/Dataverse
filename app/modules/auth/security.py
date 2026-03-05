from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

MAX_BCRYPT_PASSWORD_BYTES = 72
DEFAULT_DEV_SECRET = "dataverse-dev-insecure-change-me"
JWT_SECRET_KEY = os.getenv("DATAVERSE_JWT_SECRET", DEFAULT_DEV_SECRET)
JWT_ALGORITHM = os.getenv("DATAVERSE_JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("DATAVERSE_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("DATAVERSE_REFRESH_TOKEN_EXPIRE_MINUTES", "43200"))

_RUNTIME_ENV = (os.getenv("DATAVERSE_ENV") or os.getenv("ENV") or "dev").strip().lower()
if _RUNTIME_ENV in {"prod", "production"} and JWT_SECRET_KEY == DEFAULT_DEV_SECRET:
    raise RuntimeError("DATAVERSE_JWT_SECRET must be configured in production")


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass(frozen=True)
class TokenClaims:
    user_id: UUID
    session_id: UUID
    token_type: str
    issued_at: datetime
    expires_at: datetime


def utc_now() -> datetime:
    return datetime.now(UTC)


def _validate_password_length(password: str) -> None:
    if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Password is too long (max {MAX_BCRYPT_PASSWORD_BYTES} bytes for bcrypt).",
        )


def hash_password(password: str) -> str:
    _validate_password_length(password)
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def _build_token(*, user_id: UUID, session_id: UUID, token_type: str, expires_minutes: int) -> tuple[str, datetime]:
    now = utc_now()
    expires_at = now + timedelta(minutes=max(1, int(expires_minutes)))
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM), expires_at


def create_access_token(*, user_id: UUID, session_id: UUID) -> tuple[str, datetime]:
    return _build_token(
        user_id=user_id,
        session_id=session_id,
        token_type="access",
        expires_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def create_refresh_token(*, user_id: UUID, session_id: UUID) -> tuple[str, datetime]:
    return _build_token(
        user_id=user_id,
        session_id=session_id,
        token_type="refresh",
        expires_minutes=REFRESH_TOKEN_EXPIRE_MINUTES,
    )


def decode_token(token: str, *, expected_type: str | None = None) -> TokenClaims:
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

    subject = payload.get("sub")
    session = payload.get("sid")
    token_type = str(payload.get("typ") or "access").strip().lower()
    iat_raw = payload.get("iat")
    exp_raw = payload.get("exp")

    if not isinstance(subject, str) or not isinstance(session, str):
        raise ValueError("Missing token subject or session")
    if expected_type is not None and token_type != expected_type:
        raise ValueError("Invalid token type")
    if not isinstance(iat_raw, int | float) or not isinstance(exp_raw, int | float):
        raise ValueError("Missing token times")

    return TokenClaims(
        user_id=UUID(subject),
        session_id=UUID(session),
        token_type=token_type,
        issued_at=datetime.fromtimestamp(float(iat_raw), tz=UTC),
        expires_at=datetime.fromtimestamp(float(exp_raw), tz=UTC),
    )


def decode_token_safe(token: str, *, expected_type: str | None = None) -> TokenClaims:
    try:
        return decode_token(token, expected_type=expected_type)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
