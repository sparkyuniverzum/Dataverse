from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.db_advisory_lock import acquire_transaction_lock
from app.models import Branch, Event


class CosmosServiceBranches:
    async def list_branches(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
    ) -> list[Branch]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        return list(
            (
                await session.execute(
                    select(Branch)
                    .where(
                        Branch.galaxy_id == galaxy.id,
                        Branch.deleted_at.is_(None),
                    )
                    .order_by(Branch.created_at.asc(), Branch.id.asc())
                )
            )
            .scalars()
            .all()
        )

    async def resolve_branch_id(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> UUID | None:
        if branch_id is None:
            return None

        await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (await session.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")
        return branch.id

    async def create_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        name: str,
        as_of: datetime | None,
    ) -> Branch:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch_name = str(name).strip()
        if not branch_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Branch name cannot be empty")
        normalized_name = self._normalize_branch_name(branch_name)

        lock_key = self._branch_name_lock_key(galaxy_id=galaxy.id, normalized_name=normalized_name)
        await acquire_transaction_lock(session, key=lock_key)

        existing_active_branches = list(
            (
                await session.execute(
                    select(Branch).where(
                        and_(
                            Branch.galaxy_id == galaxy.id,
                            Branch.deleted_at.is_(None),
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        for existing in existing_active_branches:
            if self._normalize_branch_name(existing.name) == normalized_name:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Branch with the same normalized name already exists in this galaxy",
                )

        latest_event_stmt = (
            select(Event)
            .where(
                Event.user_id == user_id,
                Event.galaxy_id == galaxy.id,
                Event.branch_id.is_(None),
            )
            .order_by(Event.event_seq.desc())
            .limit(1)
        )
        if as_of is not None:
            latest_event_stmt = latest_event_stmt.where(Event.timestamp <= as_of)
        latest_event = (await session.execute(latest_event_stmt)).scalar_one_or_none()

        branch = Branch(
            galaxy_id=galaxy.id,
            name=branch_name,
            base_event_id=latest_event.id if latest_event is not None else None,
            created_by=user_id,
        )
        session.add(branch)
        try:
            await session.flush()
        except IntegrityError as exc:
            if "uq_branches_galaxy_name_norm_active" in str(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Branch with the same normalized name already exists in this galaxy",
                ) from exc
            raise
        await session.refresh(branch)
        return branch

    async def promote_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        branch_id: UUID,
    ) -> tuple[Branch, int]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (
            await session.execute(select(Branch).where(Branch.id == branch_id).with_for_update())
        ).scalar_one_or_none()
        if branch is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")
        if branch.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Branch is closed and cannot be promoted",
            )

        branch_events = list(
            (
                await session.execute(
                    select(Event)
                    .where(
                        and_(
                            Event.user_id == user_id,
                            Event.galaxy_id == galaxy.id,
                            Event.branch_id == branch.id,
                        )
                    )
                    .order_by(Event.event_seq.asc())
                )
            )
            .scalars()
            .all()
        )

        promoted_events: list[Event] = []
        for event in branch_events:
            promoted = await self.event_store.append_event(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy.id,
                branch_id=None,
                entity_id=event.entity_id,
                event_type=event.event_type,
                payload=event.payload if isinstance(event.payload, dict) else {},
            )
            promoted_events.append(promoted)

        if promoted_events:
            await self.read_model_projector.apply_events(session=session, events=promoted_events)

        branch.deleted_at = datetime.now(UTC)
        return branch, len(promoted_events)

    async def close_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        branch_id: UUID,
    ) -> Branch:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (
            await session.execute(select(Branch).where(Branch.id == branch_id).with_for_update())
        ).scalar_one_or_none()
        if branch is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")
        if branch.deleted_at is None:
            branch.deleted_at = datetime.now(UTC)
        return branch
