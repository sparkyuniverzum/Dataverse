"""enforce unique active branch names per galaxy (normalized)

Revision ID: 20260301_0010
Revises: 20260301_0009
Create Date: 2026-03-01 21:30:00
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260301_0010"
down_revision = "20260301_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX uq_branches_galaxy_name_norm_active
        ON branches (galaxy_id, lower(btrim(name)))
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_branches_galaxy_name_norm_active")
