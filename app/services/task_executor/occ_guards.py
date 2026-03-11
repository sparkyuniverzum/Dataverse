from __future__ import annotations

from hashlib import blake2b
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.db_advisory_lock import acquire_transaction_lock
from app.models import Event


class OccGuards:
    @staticmethod
    def bond_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        source_civilization_id: UUID,
        target_civilization_id: UUID,
        bond_type: str,
    ) -> int:
        digest = blake2b(
            f"{user_id}:{galaxy_id}:{source_civilization_id}:{target_civilization_id}:{bond_type}".encode(),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    @staticmethod
    def occ_scope_lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> int:
        branch_scope = str(branch_id) if branch_id is not None else "main"
        digest = blake2b(
            f"occ:{user_id}:{galaxy_id}:{branch_scope}".encode(),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    @staticmethod
    def parse_expected_event_seq(value: object, *, field_name: str) -> int | None:
        if value is None:
            return None
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{field_name} must be a non-negative integer",
            ) from None
        if parsed < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{field_name} must be a non-negative integer",
            )
        return parsed

    @staticmethod
    async def current_entity_event_seq(
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
    ) -> int:
        stmt = select(func.max(Event.event_seq)).where(
            Event.user_id == user_id,
            Event.galaxy_id == galaxy_id,
            Event.entity_id == entity_id,
        )
        if branch_id is None:
            stmt = stmt.where(Event.branch_id.is_(None))
        else:
            stmt = stmt.where(Event.branch_id == branch_id)
        latest = (await session.execute(stmt)).scalar_one_or_none()
        return int(latest or 0)

    @classmethod
    async def enforce_expected_entity_event_seq(
        cls,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        entity_id: UUID,
        expected_event_seq: int | None,
        context: str,
    ) -> None:
        if expected_event_seq is None:
            return
        lock_key = cls.occ_scope_lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
        await acquire_transaction_lock(session, key=lock_key)
        current_event_seq = await cls.current_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=entity_id,
        )
        if current_event_seq != expected_event_seq:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "OCC_CONFLICT",
                    "message": f"OCC conflict for {context}",
                    "context": context,
                    "entity_id": str(entity_id),
                    "expected_event_seq": expected_event_seq,
                    "current_event_seq": current_event_seq,
                },
            )

    @staticmethod
    def canonical_relation_pair(source_civilization_id: UUID, target_civilization_id: UUID) -> tuple[UUID, UUID]:
        if source_civilization_id.hex <= target_civilization_id.hex:
            return source_civilization_id, target_civilization_id
        return target_civilization_id, source_civilization_id
