"""add star core interior entry started at

Revision ID: 20260314_0026
Revises: 20260310_0025
Create Date: 2026-03-14 15:10:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260314_0026"
down_revision = "20260310_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "star_core_policies",
        sa.Column("interior_entry_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_star_core_policies_interior_entry_started_at",
        "star_core_policies",
        ["interior_entry_started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_star_core_policies_interior_entry_started_at", table_name="star_core_policies")
    op.drop_column("star_core_policies", "interior_entry_started_at")
