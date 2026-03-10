"""add event outbox table for transactional event delivery

Revision ID: 20260310_0024
Revises: 20260308_0023
Create Date: 2026-03-10 03:05:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260310_0024"
down_revision = "20260308_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_outbox",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("domain_event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("trace_id", sa.Text(), nullable=False),
        sa.Column("correlation_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.CheckConstraint("status in ('pending','published','failed')", name="ck_event_outbox_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_outbox_aggregate_id", "event_outbox", ["aggregate_id"], unique=False)
    op.create_index("ix_event_outbox_available_at", "event_outbox", ["available_at"], unique=False)
    op.create_index("ix_event_outbox_correlation_id", "event_outbox", ["correlation_id"], unique=False)
    op.create_index("ix_event_outbox_created_at", "event_outbox", ["created_at"], unique=False)
    op.create_index("ix_event_outbox_domain_event_id", "event_outbox", ["domain_event_id"], unique=True)
    op.create_index("ix_event_outbox_event_type", "event_outbox", ["event_type"], unique=False)
    op.create_index("ix_event_outbox_published_at", "event_outbox", ["published_at"], unique=False)
    op.create_index("ix_event_outbox_status", "event_outbox", ["status"], unique=False)
    op.create_index("ix_event_outbox_trace_id", "event_outbox", ["trace_id"], unique=False)
    op.create_index("ix_event_outbox_status_available_at", "event_outbox", ["status", "available_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_event_outbox_status_available_at", table_name="event_outbox")
    op.drop_index("ix_event_outbox_trace_id", table_name="event_outbox")
    op.drop_index("ix_event_outbox_status", table_name="event_outbox")
    op.drop_index("ix_event_outbox_published_at", table_name="event_outbox")
    op.drop_index("ix_event_outbox_event_type", table_name="event_outbox")
    op.drop_index("ix_event_outbox_domain_event_id", table_name="event_outbox")
    op.drop_index("ix_event_outbox_created_at", table_name="event_outbox")
    op.drop_index("ix_event_outbox_correlation_id", table_name="event_outbox")
    op.drop_index("ix_event_outbox_available_at", table_name="event_outbox")
    op.drop_index("ix_event_outbox_aggregate_id", table_name="event_outbox")
    op.drop_table("event_outbox")
