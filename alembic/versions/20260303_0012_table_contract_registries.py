"""add formula and physics registries to table contracts

Revision ID: 20260303_0012
Revises: 20260302_0011
Create Date: 2026-03-03 00:45:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260303_0012"
down_revision = "20260302_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "table_contracts",
        sa.Column(
            "formula_registry",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "table_contracts",
        sa.Column(
            "physics_rulebook",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("table_contracts", "physics_rulebook")
    op.drop_column("table_contracts", "formula_registry")
