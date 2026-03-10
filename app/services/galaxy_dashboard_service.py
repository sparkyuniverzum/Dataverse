from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GalaxyActivityRM, GalaxyHealthRM, GalaxySummaryRM
from app.services.projection.read_model_projector import ReadModelProjector


class GalaxyDashboardService:
    def __init__(self, *, projector: ReadModelProjector | None = None) -> None:
        self.projector = projector or ReadModelProjector()

    async def get_summary(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> GalaxySummaryRM:
        summary = await self._load_summary(session=session, user_id=user_id, galaxy_id=galaxy_id)
        if summary is not None:
            return summary

        await self.projector.refresh_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        summary = await self._load_summary(session=session, user_id=user_id, galaxy_id=galaxy_id)
        if summary is None:
            raise RuntimeError("Failed to materialize galaxy summary read-model")
        return summary

    async def get_health(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> GalaxyHealthRM:
        health = await self._load_health(session=session, user_id=user_id, galaxy_id=galaxy_id)
        if health is not None:
            return health

        await self.projector.refresh_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        health = await self._load_health(session=session, user_id=user_id, galaxy_id=galaxy_id)
        if health is None:
            raise RuntimeError("Failed to materialize galaxy health read-model")
        return health

    async def list_activity(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        limit: int = 40,
    ) -> list[GalaxyActivityRM]:
        safe_limit = max(1, min(200, int(limit)))
        return list(
            (
                await session.execute(
                    select(GalaxyActivityRM)
                    .where(
                        and_(
                            GalaxyActivityRM.user_id == user_id,
                            GalaxyActivityRM.galaxy_id == galaxy_id,
                        )
                    )
                    .order_by(GalaxyActivityRM.event_seq.desc(), GalaxyActivityRM.created_at.desc())
                    .limit(safe_limit)
                )
            )
            .scalars()
            .all()
        )

    async def _load_summary(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> GalaxySummaryRM | None:
        return (
            await session.execute(
                select(GalaxySummaryRM).where(
                    and_(
                        GalaxySummaryRM.user_id == user_id,
                        GalaxySummaryRM.galaxy_id == galaxy_id,
                    )
                )
            )
        ).scalar_one_or_none()

    async def _load_health(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
    ) -> GalaxyHealthRM | None:
        return (
            await session.execute(
                select(GalaxyHealthRM).where(
                    and_(
                        GalaxyHealthRM.user_id == user_id,
                        GalaxyHealthRM.galaxy_id == galaxy_id,
                    )
                )
            )
        ).scalar_one_or_none()
