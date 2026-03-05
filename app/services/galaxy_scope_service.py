from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Galaxy


async def resolve_user_galaxy_for_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    galaxy_id: UUID | None,
) -> Galaxy:
    if galaxy_id is None:
        galaxy = (
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
            .first()
        )
        if galaxy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active galaxy for user")
        return galaxy

    candidate = (await session.execute(select(Galaxy).where(Galaxy.id == galaxy_id))).scalar_one_or_none()
    if candidate is None or candidate.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
    if candidate.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")
    return candidate
