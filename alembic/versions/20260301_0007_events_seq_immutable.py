"""add deterministic event ordering and immutable update guard

Revision ID: 20260301_0007
Revises: 20260301_0006
Create Date: 2026-03-01 14:30:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260301_0007"
down_revision = "20260301_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("event_seq", sa.BigInteger(), nullable=True))

    op.execute("CREATE SEQUENCE IF NOT EXISTS events_event_seq_seq OWNED BY events.event_seq")
    op.execute("ALTER TABLE events ALTER COLUMN event_seq SET DEFAULT nextval('events_event_seq_seq')")
    op.execute("UPDATE events SET event_seq = nextval('events_event_seq_seq') WHERE event_seq IS NULL")

    op.alter_column("events", "event_seq", nullable=False)
    op.create_unique_constraint("uq_events_event_seq", "events", ["event_seq"])
    op.create_index("ix_events_event_seq", "events", ["event_seq"], unique=False)
    op.create_index(
        "ix_events_user_galaxy_branch_event_seq",
        "events",
        ["user_id", "galaxy_id", "branch_id", "event_seq"],
        unique=False,
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_event_update()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'EVENT UPDATE is forbidden in DataVerse. Events are append-only.';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_events_no_update
        BEFORE UPDATE ON events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_event_update();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_events_no_update ON events")
    op.execute("DROP FUNCTION IF EXISTS prevent_event_update")

    op.drop_index("ix_events_user_galaxy_branch_event_seq", table_name="events")
    op.drop_index("ix_events_event_seq", table_name="events")
    op.drop_constraint("uq_events_event_seq", "events", type_="unique")

    op.execute("ALTER TABLE events ALTER COLUMN event_seq DROP DEFAULT")
    op.drop_column("events", "event_seq")
    op.execute("DROP SEQUENCE IF EXISTS events_event_seq_seq")
