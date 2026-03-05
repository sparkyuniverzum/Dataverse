"""add star core physical profile columns

Revision ID: 20260305_0019
Revises: 20260305_0018
Create Date: 2026-03-05 13:10:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260305_0019"
down_revision = "20260305_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "star_core_policies",
        sa.Column("physical_profile_key", sa.Text(), nullable=False, server_default=sa.text("'BALANCE'")),
    )
    op.add_column(
        "star_core_policies",
        sa.Column("physical_profile_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column("star_core_policies", "physical_profile_version")
    op.drop_column("star_core_policies", "physical_profile_key")
