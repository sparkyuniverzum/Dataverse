from __future__ import annotations

"""Deprecated legacy service.

Not used by the active write path (`TaskExecutorService` + event store).
Kept only for backwards compatibility until hard removal.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Atom, Bond


class BondService:
    async def link(
        self,
        session: AsyncSession,
        source_id: UUID,
        target_id: UUID,
        bond_type: str,
    ) -> Bond:
        if source_id == target_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="source_id and target_id must be different",
            )

        source_atom = (
            await session.execute(
                select(Atom).where(
                    Atom.id == source_id,
                    Atom.is_deleted.is_(False),
                )
            )
        ).scalar_one_or_none()
        if source_atom is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source atom not found")

        target_atom = (
            await session.execute(
                select(Atom).where(
                    Atom.id == target_id,
                    Atom.is_deleted.is_(False),
                )
            )
        ).scalar_one_or_none()
        if target_atom is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target atom not found")

        existing_bond = (
            await session.execute(
                select(Bond).where(
                    Bond.source_id == source_id,
                    Bond.target_id == target_id,
                    Bond.type == bond_type,
                    Bond.is_deleted.is_(False),
                )
            )
        ).scalar_one_or_none()
        if existing_bond is not None:
            return existing_bond

        bond = Bond(source_id=source_id, target_id=target_id, type=bond_type)
        session.add(bond)
        await session.flush()
        await session.refresh(bond)
        return bond

    async def extinguish(self, session: AsyncSession, bond_id: UUID) -> Bond | None:
        bond = (await session.execute(select(Bond).where(Bond.id == bond_id))).scalar_one_or_none()
        if bond is None:
            return None
        if not bond.is_deleted:
            bond.is_deleted = True
            bond.deleted_at = datetime.now(timezone.utc)
        return bond
