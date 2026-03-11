"""legacy rename checkpoint (no-op on canonical baseline)

Revision ID: c54a9ee3e096
Revises: 20260306_0020
Create Date: 2026-03-07 20:23:35.136977

"""

from __future__ import annotations


# revision identifiers, used by Alembic.
revision = "c54a9ee3e096"
down_revision = "20260306_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Canonical schema is created in earlier migrations.
    pass


def downgrade() -> None:
    pass
