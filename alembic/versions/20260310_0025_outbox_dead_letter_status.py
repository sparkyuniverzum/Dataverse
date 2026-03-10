"""add dead_letter status to event_outbox

Revision ID: 20260310_0025
Revises: 20260310_0024
Create Date: 2026-03-10 03:20:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260310_0025"
down_revision = "20260310_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_event_outbox_status", "event_outbox", type_="check")
    op.create_check_constraint(
        "ck_event_outbox_status",
        "event_outbox",
        "status in ('pending','published','failed','dead_letter')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_event_outbox_status", "event_outbox", type_="check")
    op.create_check_constraint(
        "ck_event_outbox_status",
        "event_outbox",
        "status in ('pending','published','failed')",
    )
