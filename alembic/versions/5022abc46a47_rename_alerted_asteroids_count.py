"""legacy dashboard rename checkpoint (no-op on canonical baseline)

Revision ID: 5022abc46a47
Revises: c6c1577901aa
Create Date: 2026-03-07 20:54:33.493110

"""

from __future__ import annotations


# revision identifiers, used by Alembic.
revision = "5022abc46a47"
down_revision = "c6c1577901aa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Canonical schema is created in earlier migrations.
    pass


def downgrade() -> None:
    pass
