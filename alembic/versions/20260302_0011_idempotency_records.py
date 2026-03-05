"""add idempotency records for write endpoints

Revision ID: 20260302_0011
Revises: 20260301_0010
Create Date: 2026-03-02 20:30:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260302_0011"
down_revision = "20260301_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "idempotency_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_scope", sa.Text(), nullable=False, server_default=sa.text("'main'")),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("request_hash", sa.Text(), nullable=False),
        sa.Column(
            "response_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status_code", sa.Integer(), nullable=False, server_default=sa.text("200")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_idempotency_records_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_idempotency_records_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_idempotency_records_user_id", "idempotency_records", ["user_id"], unique=False)
    op.create_index("ix_idempotency_records_galaxy_id", "idempotency_records", ["galaxy_id"], unique=False)
    op.create_index("ix_idempotency_records_created_at", "idempotency_records", ["created_at"], unique=False)
    op.create_index(
        "ux_idempotency_scope_key",
        "idempotency_records",
        ["user_id", "galaxy_id", "branch_scope", "endpoint", "idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_idempotency_scope_key", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_created_at", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_galaxy_id", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_user_id", table_name="idempotency_records")
    op.drop_table("idempotency_records")
