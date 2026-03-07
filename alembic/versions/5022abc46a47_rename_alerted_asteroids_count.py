"""rename_alerted_asteroids_count

Revision ID: 5022abc46a47
Revises: c6c1577901aa
Create Date: 2026-03-07 20:54:33.493110

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '5022abc46a47'
down_revision = 'c6c1577901aa'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("galaxy_health_rm", "alerted_asteroids_count", new_column_name="alerted_civilizations_count")


def downgrade() -> None:
    op.alter_column("galaxy_health_rm", "alerted_civilizations_count", new_column_name="alerted_asteroids_count")
