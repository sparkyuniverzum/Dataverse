from __future__ import annotations

import json
from dataclasses import dataclass
from hashlib import blake2b, sha256
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select, text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IdempotencyRecord


@dataclass(frozen=True)
class IdempotencyReplay:
    status_code: int
    response_payload: dict[str, Any]


class IdempotencyService:
    @staticmethod
    def _branch_scope(branch_id: UUID | None) -> str:
        return str(branch_id) if branch_id is not None else "main"

    @staticmethod
    def _lock_key(
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_scope: str,
        endpoint: str,
        idempotency_key: str,
    ) -> int:
        digest = blake2b(
            f"{user_id}:{galaxy_id}:{branch_scope}:{endpoint}:{idempotency_key}".encode(),
            digest_size=8,
        ).digest()
        return int.from_bytes(digest, byteorder="big", signed=True)

    @staticmethod
    def request_hash(payload: dict[str, Any]) -> str:
        normalized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
        return sha256(normalized.encode("utf-8")).hexdigest()

    async def check_replay(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        endpoint: str,
        idempotency_key: str,
        request_hash: str,
    ) -> IdempotencyReplay | None:
        branch_scope = self._branch_scope(branch_id)
        lock_key = self._lock_key(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_scope=branch_scope,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
        )
        await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})

        existing = (
            await session.execute(
                select(IdempotencyRecord).where(
                    and_(
                        IdempotencyRecord.user_id == user_id,
                        IdempotencyRecord.galaxy_id == galaxy_id,
                        IdempotencyRecord.branch_scope == branch_scope,
                        IdempotencyRecord.endpoint == endpoint,
                        IdempotencyRecord.idempotency_key == idempotency_key,
                    )
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            return None

        if existing.request_hash != request_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency key was already used with a different request payload",
            )
        payload = existing.response_payload if isinstance(existing.response_payload, dict) else {}
        return IdempotencyReplay(status_code=int(existing.status_code), response_payload=payload)

    async def store_response(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        endpoint: str,
        idempotency_key: str,
        request_hash: str,
        status_code: int,
        response_payload: dict[str, Any],
    ) -> None:
        record = IdempotencyRecord(
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_scope=self._branch_scope(branch_id),
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            status_code=int(status_code),
            response_payload=response_payload if isinstance(response_payload, dict) else {},
        )
        session.add(record)
        await session.flush()
