from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MoonCapability
from app.services.moon_capability_matrix import ensure_capability_matrix_transition


class CosmosServiceCapabilities:
    async def list_moon_capabilities(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
        include_inactive: bool = False,
        include_history: bool = False,
    ) -> list[MoonCapability]:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        await self._ensure_planet_contract_exists(
            session=session,
            galaxy_id=galaxy.id,
            table_id=table_id,
        )

        stmt = select(MoonCapability).where(
            and_(
                MoonCapability.galaxy_id == galaxy.id,
                MoonCapability.table_id == table_id,
            )
        )
        if not include_history:
            stmt = stmt.where(MoonCapability.deleted_at.is_(None))
        if not include_inactive:
            stmt = stmt.where(MoonCapability.status == "active")

        rows = (
            await session.execute(
                stmt.order_by(
                    MoonCapability.order_index.asc(),
                    MoonCapability.capability_key.asc(),
                    MoonCapability.version.desc(),
                    MoonCapability.created_at.desc(),
                )
            )
        ).scalars()
        return list(rows.all())

    async def upsert_moon_capability(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        table_id: UUID,
        capability_key: str,
        capability_class: str,
        config: dict[str, Any],
        order_index: int,
        status_value: str = "active",
    ) -> MoonCapability:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        await self._ensure_planet_contract_exists(
            session=session,
            galaxy_id=galaxy.id,
            table_id=table_id,
        )

        normalized_key = self._normalize_capability_key(capability_key)
        normalized_class = self._normalize_capability_class(capability_class)
        normalized_status = self._normalize_capability_status(status_value)
        normalized_config = config if isinstance(config, dict) else {}
        normalized_order_index = max(0, int(order_index))

        latest_active = (
            await session.execute(
                select(MoonCapability)
                .where(
                    and_(
                        MoonCapability.galaxy_id == galaxy.id,
                        MoonCapability.table_id == table_id,
                        MoonCapability.capability_key == normalized_key,
                        MoonCapability.deleted_at.is_(None),
                    )
                )
                .order_by(MoonCapability.version.desc(), MoonCapability.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if latest_active is not None:
            ensure_capability_matrix_transition(
                capability_key=normalized_key,
                current_class=str(latest_active.capability_class),
                requested_class=normalized_class,
            )

        if (
            latest_active is not None
            and latest_active.capability_class == normalized_class
            and latest_active.config_json == normalized_config
            and latest_active.order_index == normalized_order_index
            and latest_active.status == normalized_status
        ):
            return latest_active

        next_version = (int(latest_active.version) + 1) if latest_active is not None else 1
        now = datetime.now(UTC)
        if latest_active is not None:
            latest_active.deleted_at = now
            latest_active.updated_at = now
            await session.flush()

        capability = MoonCapability(
            galaxy_id=galaxy.id,
            table_id=table_id,
            capability_key=normalized_key,
            capability_class=normalized_class,
            config_json=normalized_config,
            order_index=normalized_order_index,
            status=normalized_status,
            version=next_version,
            created_by=user_id,
        )
        session.add(capability)
        await session.flush()
        await session.refresh(capability)
        return capability

    async def update_moon_capability(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        capability_id: UUID,
        capability_class: str | None = None,
        config: dict[str, Any] | None = None,
        order_index: int | None = None,
        status_value: str | None = None,
        expected_version: int | None = None,
    ) -> MoonCapability:
        galaxy = await self._resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        current = (
            await session.execute(
                select(MoonCapability).where(
                    and_(
                        MoonCapability.id == capability_id,
                        MoonCapability.galaxy_id == galaxy.id,
                        MoonCapability.deleted_at.is_(None),
                    )
                )
            )
        ).scalar_one_or_none()
        if current is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moon capability not found")

        if expected_version is not None and int(expected_version) != int(current.version):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "OCC_CONFLICT",
                    "context": "moon_capability_update",
                    "entity_id": str(current.id),
                    "expected_version": int(expected_version),
                    "current_version": int(current.version),
                },
            )

        next_class = (
            self._normalize_capability_class(capability_class)
            if capability_class is not None
            else str(current.capability_class)
        )
        next_config = config if isinstance(config, dict) else dict(current.config_json or {})
        next_order_index = max(0, int(order_index)) if order_index is not None else int(current.order_index)
        next_status = (
            self._normalize_capability_status(status_value) if status_value is not None else str(current.status)
        )
        ensure_capability_matrix_transition(
            capability_key=str(current.capability_key),
            current_class=str(current.capability_class),
            requested_class=next_class,
        )

        if (
            next_class == str(current.capability_class)
            and next_config == (current.config_json if isinstance(current.config_json, dict) else {})
            and next_order_index == int(current.order_index)
            and next_status == str(current.status)
        ):
            return current

        now = datetime.now(UTC)
        current.deleted_at = now
        current.updated_at = now
        await session.flush()

        next_row = MoonCapability(
            galaxy_id=current.galaxy_id,
            table_id=current.table_id,
            capability_key=str(current.capability_key),
            capability_class=next_class,
            config_json=next_config,
            order_index=next_order_index,
            status=next_status,
            version=int(current.version) + 1,
            created_by=user_id,
        )
        session.add(next_row)
        await session.flush()
        await session.refresh(next_row)
        return next_row

    async def deprecate_moon_capability(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        capability_id: UUID,
        expected_version: int | None = None,
    ) -> MoonCapability:
        return await self.update_moon_capability(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            capability_id=capability_id,
            status_value="deprecated",
            expected_version=expected_version,
        )
