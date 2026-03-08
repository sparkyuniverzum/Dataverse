from __future__ import annotations

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession


async def acquire_transaction_lock(session: AsyncSession, *, key: int) -> None:
    """Acquire advisory xact lock on PostgreSQL; no-op on non-Postgres backends."""
    bind = session.get_bind()
    dialect_name = getattr(getattr(bind, "dialect", None), "name", "")
    if str(dialect_name).lower() != "postgresql":
        return
    await session.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": int(key)})
