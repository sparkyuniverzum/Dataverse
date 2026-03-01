"""enforce unique active bond per relation tuple

Revision ID: 20260301_0008
Revises: 20260301_0007
Create Date: 2026-03-01 15:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260301_0008"
down_revision = "20260301_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill safety: if historical duplicates exist, keep the earliest active row and soft-delete the rest.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, galaxy_id, source_id, target_id, type
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM bonds
            WHERE is_deleted = FALSE
        )
        UPDATE bonds b
        SET is_deleted = TRUE,
            deleted_at = COALESCE(b.deleted_at, now())
        FROM ranked r
        WHERE b.id = r.id
          AND r.rn > 1
          AND b.is_deleted = FALSE;
        """
    )

    op.create_index(
        "ux_bonds_active_relation",
        "bonds",
        ["user_id", "galaxy_id", "source_id", "target_id", "type"],
        unique=True,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )


def downgrade() -> None:
    op.drop_index("ux_bonds_active_relation", table_name="bonds")
