from __future__ import annotations

from datetime import datetime, timezone
from hashlib import blake2b
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select, text as sql_text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Branch, Event, Galaxy, TableContract
from app.services.event_store_service import EventStoreService
from app.services.read_model_projector import ReadModelProjector


class CosmosService:
    def __init__(
        self,
        *,
        event_store: EventStoreService | None = None,
        read_model_projector: ReadModelProjector | None = None,
    ) -> None:
        self.event_store = event_store or EventStoreService()
        self.read_model_projector = read_model_projector or ReadModelProjector()

    async def _resolve_user_galaxy(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
    ) -> Galaxy:
        if galaxy_id is None:
            galaxy = (
                await session.execute(
                    select(Galaxy)
                    .where(
                        Galaxy.owner_id == user_id,
                        Galaxy.deleted_at.is_(None),
                    )
                    .order_by(Galaxy.created_at.asc(), Galaxy.id.asc())
                )
            ).scalars().first()
            if galaxy is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active galaxy for user")
            return galaxy

        candidate = (await session.execute(select(Galaxy).where(Galaxy.id == galaxy_id))).scalar_one_or_none()
        if candidate is None or candidate.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Galaxy not found")
        if candidate.owner_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden galaxy access")
        return candidate

    @staticmethod
    def _normalize_string_list(values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for raw in values:
            value = str(raw).strip()
            if not value or value in seen:
                continue
            seen.add(value)
            result.append(value)
        return result

    @staticmethod
    def _normalize_branch_name(name: str) -> str:
        return str(name).strip().casefold()

    @staticmethod
    def _branch_name_lock_key(*, galaxy_id: UUID, normalized_name: str) -> int:
        digest = blake2b(
            f"{galaxy_id}:{normalized_name}".encode("utf-8"),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

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
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Branch name cannot be empty")
        normalized_name = self._normalize_branch_name(branch_name)

        lock_key = self._branch_name_lock_key(galaxy_id=galaxy.id, normalized_name=normalized_name)
        await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

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

    async def extinguish_branch(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID | None,
        branch_id: UUID,
    ) -> Branch:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        branch = (await session.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")
        if branch.deleted_at is None:
            branch.deleted_at = datetime.now(timezone.utc)
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
            await session.execute(
                select(Branch)
                .where(Branch.id == branch_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if branch is None or branch.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
        if branch.galaxy_id != galaxy.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden branch access")

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

        branch.deleted_at = datetime.now(timezone.utc)
        return branch, len(promoted_events)

    async def get_table_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
    ) -> TableContract:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        contract = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy.id,
                        TableContract.table_id == table_id,
                        TableContract.deleted_at.is_(None),
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.created_at.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table contract not found")
        return contract

    async def upsert_table_contract(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
        required_fields: list[str],
        field_types: dict[str, str],
        unique_rules: list[dict[str, Any]],
        validators: list[dict[str, Any]],
    ) -> TableContract:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)

        latest = (
            await session.execute(
                select(TableContract)
                .where(
                    and_(
                        TableContract.galaxy_id == galaxy.id,
                        TableContract.table_id == table_id,
                    )
                )
                .order_by(TableContract.version.desc(), TableContract.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        next_version = (latest.version + 1) if latest is not None else 1

        normalized_required = self._normalize_string_list(required_fields)
        normalized_field_types: dict[str, str] = {}
        for raw_key, raw_type in field_types.items():
            key = str(raw_key).strip()
            type_value = str(raw_type).strip().lower()
            if key and type_value:
                normalized_field_types[key] = type_value

        contract = TableContract(
            galaxy_id=galaxy.id,
            table_id=table_id,
            version=next_version,
            required_fields=normalized_required,
            field_types=normalized_field_types,
            unique_rules=[item for item in unique_rules if isinstance(item, dict)],
            validators=[item for item in validators if isinstance(item, dict)],
            created_by=user_id,
        )
        session.add(contract)
        await session.flush()
        await session.refresh(contract)
        return contract
