"""add star core policy lock table

Revision ID: 20260305_0018
Revises: 20260304_0017
Create Date: 2026-03-05 10:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260305_0018"
down_revision = "20260304_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "star_core_policies",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_key", sa.Text(), nullable=False, server_default=sa.text("'ORIGIN'")),
        sa.Column("law_preset", sa.Text(), nullable=False, server_default=sa.text("'balanced'")),
        sa.Column("no_hard_delete", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("deletion_mode", sa.Text(), nullable=False, server_default=sa.text("'soft_delete'")),
        sa.Column("soft_delete_flag_field", sa.Text(), nullable=False, server_default=sa.text("'is_deleted'")),
        sa.Column("soft_delete_timestamp_field", sa.Text(), nullable=False, server_default=sa.text("'deleted_at'")),
        sa.Column("event_sourcing_enabled", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("occ_enforced", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("idempotency_supported", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("branch_scope_supported", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("lock_status", sa.Text(), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("policy_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_star_core_policies_galaxy_id_galaxies"),
        sa.ForeignKeyConstraint(["locked_by"], ["users.id"], name="fk_star_core_policies_locked_by_users"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_star_core_policies_user_id_users"),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id"),
    )

    op.create_index("ix_star_core_policies_created_at", "star_core_policies", ["created_at"], unique=False)
    op.create_index("ix_star_core_policies_updated_at", "star_core_policies", ["updated_at"], unique=False)
    op.create_index("ix_star_core_policies_locked_at", "star_core_policies", ["locked_at"], unique=False)
    op.create_index("ix_star_core_policies_locked_by", "star_core_policies", ["locked_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_star_core_policies_locked_by", table_name="star_core_policies")
    op.drop_index("ix_star_core_policies_locked_at", table_name="star_core_policies")
    op.drop_index("ix_star_core_policies_updated_at", table_name="star_core_policies")
    op.drop_index("ix_star_core_policies_created_at", table_name="star_core_policies")
    op.drop_table("star_core_policies")
