"""add immutable event store

Revision ID: 20260228_0002
Revises: 20260227_0001
Create Date: 2026-02-28 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260228_0002"
down_revision = "20260227_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column(
            "payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_events_galaxy_id", "events", ["galaxy_id"], unique=False)
    op.create_index("ix_events_entity_id", "events", ["entity_id"], unique=False)
    op.create_index("ix_events_event_type", "events", ["event_type"], unique=False)
    op.create_index("ix_events_timestamp", "events", ["timestamp"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_events_no_delete
        BEFORE DELETE ON events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_events_no_delete ON events")
    op.drop_index("ix_events_timestamp", table_name="events")
    op.drop_index("ix_events_event_type", table_name="events")
    op.drop_index("ix_events_entity_id", table_name="events")
    op.drop_index("ix_events_galaxy_id", table_name="events")
    op.drop_table("events")
