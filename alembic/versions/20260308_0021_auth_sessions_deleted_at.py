"""add deleted_at column to auth_sessions

Revision ID: 20260308_0021
Revises: 5022abc46a47
Create Date: 2026-03-08 09:55:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260308_0021"
down_revision = "5022abc46a47"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(str(column.get("name")) == column_name for column in columns)


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes(table_name)
    return any(str(index.get("name")) == index_name for index in indexes)


def upgrade() -> None:
    if not _has_column("auth_sessions", "deleted_at"):
        op.add_column("auth_sessions", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_index("auth_sessions", "ix_auth_sessions_deleted_at"):
        op.create_index("ix_auth_sessions_deleted_at", "auth_sessions", ["deleted_at"], unique=False)


def downgrade() -> None:
    if _has_index("auth_sessions", "ix_auth_sessions_deleted_at"):
        op.drop_index("ix_auth_sessions_deleted_at", table_name="auth_sessions")
    if _has_column("auth_sessions", "deleted_at"):
        op.drop_column("auth_sessions", "deleted_at")
