"""legacy calc-state rename checkpoint (no-op on canonical baseline)

Revision ID: c6c1577901aa
Revises: c54a9ee3e096
Create Date: 2026-03-07 20:49:16.880380

"""

from __future__ import annotations


# revision identifiers, used by Alembic.
revision = "c6c1577901aa"
down_revision = "c54a9ee3e096"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Canonical schema is created in earlier migrations.
    pass


def downgrade() -> None:
    pass
