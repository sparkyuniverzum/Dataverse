from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Galaxy, User


class GalaxyLifecycleService:
    async def delete_galaxy(self, session: AsyncSession, *, user: User, galaxy_id: UUID) -> None:
        stmt = select(Galaxy).where(
            and_(
                Galaxy.id == galaxy_id,
                Galaxy.deleted_at.is_(None),
            )
        )
        galaxy = (await session.execute(stmt)).scalar_one_or_none()

        if galaxy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
        if galaxy.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")

        galaxy.deleted_at = datetime.now(tz=UTC)
        session.add(galaxy)
        await session.flush()
