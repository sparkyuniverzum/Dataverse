"""add deleted_at column to idempotency_records

Revision ID: 20260308_0023
Revises: 20260308_0022
Create Date: 2026-03-08 10:35:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260308_0023"
down_revision = "20260308_0022"
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
    if not _has_column("idempotency_records", "deleted_at"):
        op.add_column("idempotency_records", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_index("idempotency_records", "ix_idempotency_records_deleted_at"):
        op.create_index("ix_idempotency_records_deleted_at", "idempotency_records", ["deleted_at"], unique=False)


def downgrade() -> None:
    if _has_index("idempotency_records", "ix_idempotency_records_deleted_at"):
        op.drop_index("ix_idempotency_records_deleted_at", table_name="idempotency_records")
    if _has_column("idempotency_records", "deleted_at"):
        op.drop_column("idempotency_records", "deleted_at")
