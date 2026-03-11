"""add calc_state read-model table

Revision ID: 20260303_0013
Revises: 20260303_0012
Create Date: 2026-03-03 23:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260303_0013"
down_revision = "20260303_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calc_state_rm",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("civilization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_event_seq", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("engine_version", sa.Text(), nullable=False, server_default=sa.text("'calc-v1'")),
        sa.Column(
            "calculated_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("circular_fields_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_calc_state_rm_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_calc_state_rm_galaxy_id_galaxies"),
        sa.ForeignKeyConstraint(
            ["civilization_id"],
            ["civilization_rm.id"],
            name="fk_calc_state_rm_civilization_id_civilization_rm",
        ),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id", "civilization_id", name="pk_calc_state_rm"),
    )

    op.create_index("ix_calc_state_rm_source_event_seq", "calc_state_rm", ["source_event_seq"], unique=False)
    op.create_index("ix_calc_state_rm_updated_at", "calc_state_rm", ["updated_at"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_calc_state_rm_no_delete
        BEFORE DELETE ON calc_state_rm
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_calc_state_rm_no_delete ON calc_state_rm")
    op.drop_index("ix_calc_state_rm_updated_at", table_name="calc_state_rm")
    op.drop_index("ix_calc_state_rm_source_event_seq", table_name="calc_state_rm")
    op.drop_table("calc_state_rm")
