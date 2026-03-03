from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Galaxy, User
from app.services.galaxy_scope_service import resolve_user_galaxy_for_user


JWT_SECRET_KEY = os.getenv("DATAVERSE_JWT_SECRET", "dataverse-dev-insecure-change-me")
JWT_ALGORITHM = os.getenv("DATAVERSE_JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("DATAVERSE_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
MAX_BCRYPT_PASSWORD_BYTES = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class AuthService:
    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _validate_password_length(password: str) -> None:
        # bcrypt accepts at most 72 bytes; enforce this explicitly to avoid runtime ValueError.
        if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Password is too long (max {MAX_BCRYPT_PASSWORD_BYTES} bytes for bcrypt).",
            )

    @staticmethod
    def hash_password(password: str) -> str:
        AuthService._validate_password_length(password)
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except ValueError:
            # Keep auth flow deterministic for too-long plaintext passwords.
            return False

    @staticmethod
    def create_access_token(user_id: UUID) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    async def register(
        self,
        session: AsyncSession,
        *,
        email: str,
        password: str,
        galaxy_name: str | None = None,
    ) -> tuple[User, Galaxy]:
        normalized_email = self.normalize_email(email)
        existing = (
            await session.execute(
                select(User).where(
                    User.email == normalized_email,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

        user = User(
            email=normalized_email,
            hashed_password=self.hash_password(password),
            is_active=True,
        )
        session.add(user)
        await session.flush()

        default_name = galaxy_name.strip() if galaxy_name and galaxy_name.strip() else "My Galaxy"
        galaxy = Galaxy(
            name=default_name,
            owner_id=user.id,
        )
        session.add(galaxy)
        await session.flush()
        await session.refresh(user)
        await session.refresh(galaxy)
        return user, galaxy

    async def authenticate(self, session: AsyncSession, *, email: str, password: str) -> User:
        normalized_email = self.normalize_email(email)
        user = (
            await session.execute(
                select(User).where(
                    User.email == normalized_email,
                    User.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not self.verify_password(password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return user

    async def resolve_user_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID | None) -> Galaxy:
        return await resolve_user_galaxy_for_user(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

    async def list_galaxies(self, session: AsyncSession, *, user_id: UUID) -> list[Galaxy]:
        return list(
            (
                await session.execute(
                    select(Galaxy)
                    .where(
                        Galaxy.owner_id == user_id,
                        Galaxy.deleted_at.is_(None),
                    )
                    .order_by(Galaxy.created_at.asc(), Galaxy.id.asc())
                )
            )
            .scalars()
            .all()
        )

    async def create_galaxy(self, session: AsyncSession, *, user_id: UUID, name: str) -> Galaxy:
        galaxy = Galaxy(name=name.strip(), owner_id=user_id)
        session.add(galaxy)
        await session.flush()
        await session.refresh(galaxy)
        return galaxy

    async def soft_delete_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> Galaxy:
        galaxy = await self.resolve_user_galaxy(session, user_id=user_id, galaxy_id=galaxy_id)
        if galaxy.deleted_at is None:
            galaxy.deleted_at = datetime.now(timezone.utc)
        return galaxy

    async def soft_delete_user(self, session: AsyncSession, *, user: User) -> User:
        if user.deleted_at is None:
            user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False
        return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        subject = payload.get("sub")
        if not isinstance(subject, str):
            raise credentials_exception
        user_id = UUID(subject)
    except (JWTError, ValueError):
        raise credentials_exception from None

    user = (
        await session.execute(
            select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user
