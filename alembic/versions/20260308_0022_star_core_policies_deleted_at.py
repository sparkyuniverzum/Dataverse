"""add deleted_at column to star_core_policies

Revision ID: 20260308_0022
Revises: 20260308_0021
Create Date: 2026-03-08 10:20:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260308_0022"
down_revision = "20260308_0021"
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
    if not _has_column("star_core_policies", "deleted_at"):
        op.add_column("star_core_policies", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_index("star_core_policies", "ix_star_core_policies_deleted_at"):
        op.create_index("ix_star_core_policies_deleted_at", "star_core_policies", ["deleted_at"], unique=False)


def downgrade() -> None:
    if _has_index("star_core_policies", "ix_star_core_policies_deleted_at"):
        op.drop_index("ix_star_core_policies_deleted_at", table_name="star_core_policies")
    if _has_column("star_core_policies", "deleted_at"):
        op.drop_column("star_core_policies", "deleted_at")
