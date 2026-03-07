from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthSession, Galaxy, User
from app.services.galaxy_scope_service import resolve_user_galaxy_for_user


class AuthRepository:
    async def get_user_by_email(
        self,
        session: AsyncSession,
        *,
        normalized_email: str,
        include_deleted: bool = False,
    ) -> User | None:
        stmt = select(User).where(User.email == normalized_email)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_user_by_id(self, session: AsyncSession, *, user_id: UUID) -> User | None:
        return (
            await session.execute(
                select(User).where(
                    User.id == user_id,
                    User.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def create_user(
        self,
        session: AsyncSession,
        *,
        normalized_email: str,
        hashed_password: str,
    ) -> User:
        user = User(
            email=normalized_email,
            hashed_password=hashed_password,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)
        return user

    async def create_galaxy(self, session: AsyncSession, *, user_id: UUID, name: str) -> Galaxy:
        galaxy = Galaxy(name=name, owner_id=user_id)
        session.add(galaxy)
        await session.flush()
        await session.refresh(galaxy)
        return galaxy

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

    async def resolve_user_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID | None) -> Galaxy:
        return await resolve_user_galaxy_for_user(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

    async def soft_delete_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID) -> Galaxy:
        galaxy = await self.resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        if galaxy.deleted_at is None:
            galaxy.deleted_at = datetime.now(UTC)
        return galaxy

    async def create_auth_session(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        access_expires_at: datetime,
        refresh_expires_at: datetime,
        user_agent: str | None,
        ip_address: str | None,
    ) -> AuthSession:
        auth_session = AuthSession(
            user_id=user_id,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        session.add(auth_session)
        await session.flush()
        await session.refresh(auth_session)
        return auth_session

    async def get_auth_session(
        self, session: AsyncSession, *, session_id: UUID, include_inactive: bool = False
    ) -> AuthSession | None:
        stmt = select(AuthSession).where(AuthSession.id == session_id)
        if not include_inactive:
            stmt = stmt.where(
                AuthSession.revoked_at.is_(None),
                AuthSession.deleted_at.is_(None),
            )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_active_auth_session(
        self, session: AsyncSession, *, session_id: UUID, user_id: UUID
    ) -> AuthSession | None:
        now = datetime.now(UTC)
        return (
            await session.execute(
                select(AuthSession).where(
                    and_(
                        AuthSession.id == session_id,
                        AuthSession.user_id == user_id,
                        AuthSession.revoked_at.is_(None),
                        AuthSession.deleted_at.is_(None),
                        AuthSession.refresh_expires_at > now,
                    )
                )
            )
        ).scalar_one_or_none()

    async def revoke_session(
        self,
        session: AsyncSession,
        *,
        session_id: UUID,
        revoked_reason: str,
    ) -> AuthSession | None:
        auth_session = await self.get_auth_session(session=session, session_id=session_id, include_inactive=True)
        if auth_session is None:
            return None
        if auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)
            auth_session.revoked_reason = revoked_reason
        return auth_session
