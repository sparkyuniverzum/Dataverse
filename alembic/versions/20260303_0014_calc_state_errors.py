"""add calc_state error tracking fields

Revision ID: 20260303_0014
Revises: 20260303_0013
Create Date: 2026-03-03 23:40:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260303_0014"
down_revision = "20260303_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "calc_state_rm",
        sa.Column(
            "calc_errors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "calc_state_rm",
        sa.Column("error_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("calc_state_rm", "error_count")
    op.drop_column("calc_state_rm", "calc_errors")
