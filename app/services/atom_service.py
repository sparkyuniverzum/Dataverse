from __future__ import annotations

"""Deprecated legacy service.

Not used by the active write path (`TaskExecutorService` + event store).
Kept only for backwards compatibility until hard removal.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Text, bindparam, cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Atom


class AtomService:
    async def ingest(
        self,
        session: AsyncSession,
        value: object,
        metadata: dict[str, object] | None = None,
    ) -> Atom:
        normalized_metadata = metadata or {}
        value_param = bindparam("value_param", value=value, type_=JSONB)
        existing_atom = (
            await session.execute(
                select(Atom).where(
                    Atom.is_deleted.is_(False),
                    Atom.value == value_param,
                )
            )
        ).scalar_one_or_none()
        if existing_atom is not None:
            if normalized_metadata:
                existing_atom.metadata_ = {**(existing_atom.metadata_ or {}), **normalized_metadata}
            return existing_atom

        atom = Atom(value=value, metadata_=normalized_metadata)
        session.add(atom)
        await session.flush()
        await session.refresh(atom)
        return atom

    async def extinguish(self, session: AsyncSession, atom_id: UUID) -> Atom | None:
        atom = (await session.execute(select(Atom).where(Atom.id == atom_id))).scalar_one_or_none()
        if atom is None:
            return None
        if not atom.is_deleted:
            atom.is_deleted = True
            atom.deleted_at = datetime.now(timezone.utc)
        return atom

    async def select_by_target(self, session: AsyncSession, target: str, condition: str | None) -> list[Atom]:
        stmt = select(Atom).where(
            Atom.is_deleted.is_(False),
            cast(Atom.value, Text).ilike(f"%{target}%"),
        )
        if condition:
            stmt = stmt.where(cast(Atom.value, Text).ilike(f"%{condition}%"))
        return list((await session.execute(stmt)).scalars().all())

    async def extinguish_by_target(
        self,
        session: AsyncSession,
        target: str,
        condition: str | None,
    ) -> list[Atom]:
        atoms = await self.select_by_target(session=session, target=target, condition=condition)
        for atom in atoms:
            atom.is_deleted = True
            atom.deleted_at = datetime.now(timezone.utc)
        return atoms

    async def extinguish_by_name_or_id(self, session: AsyncSession, target: str) -> list[Atom]:
        normalized_target = target.strip()
        if not normalized_target:
            return []

        try:
            atom_id = UUID(normalized_target)
        except ValueError:
            atom_id = None

        if atom_id is not None:
            atom = await self.extinguish(session=session, atom_id=atom_id)
            return [atom] if atom is not None else []

        value_param = bindparam("value_param", value=normalized_target, type_=JSONB)
        atoms = list(
            (
                await session.execute(
                    select(Atom).where(
                        Atom.is_deleted.is_(False),
                        Atom.value == value_param,
                    )
                )
            )
            .scalars()
            .all()
        )
        if not atoms:
            atoms = await self.select_by_target(session=session, target=normalized_target, condition=None)

        for atom in atoms:
            atom.is_deleted = True
            atom.deleted_at = datetime.now(timezone.utc)
        return atoms

    async def find_active_by_name_or_id(self, session: AsyncSession, target: str) -> Atom | None:
        normalized_target = target.strip()
        if not normalized_target:
            return None

        try:
            atom_id = UUID(normalized_target)
        except ValueError:
            atom_id = None

        if atom_id is not None:
            return (
                await session.execute(
                    select(Atom).where(
                        Atom.id == atom_id,
                        Atom.is_deleted.is_(False),
                    )
                )
            ).scalar_one_or_none()

        value_param = bindparam("value_param", value=normalized_target, type_=JSONB)
        exact = (
            await session.execute(
                select(Atom).where(
                    Atom.is_deleted.is_(False),
                    Atom.value == value_param,
                )
            )
        ).scalar_one_or_none()
        if exact is not None:
            return exact

        matches = await self.select_by_target(session=session, target=normalized_target, condition=None)
        return matches[0] if matches else None

    async def set_formula(
        self,
        session: AsyncSession,
        target: str,
        field: str,
        formula: str,
    ) -> Atom | None:
        atom = await self.find_active_by_name_or_id(session=session, target=target)
        if atom is None:
            return None

        metadata = dict(atom.metadata_ or {})
        metadata[field] = formula
        atom.metadata_ = metadata
        await session.flush()
        return atom
