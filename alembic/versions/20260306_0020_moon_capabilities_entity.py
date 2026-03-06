"""add moon capabilities first-class aggregate

Revision ID: 20260306_0020
Revises: 20260305_0019
Create Date: 2026-03-06 09:30:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260306_0020"
down_revision = "20260305_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "moon_capabilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("capability_key", sa.Text(), nullable=False),
        sa.Column("capability_class", sa.Text(), nullable=False),
        sa.Column(
            "config_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'active'")),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version > 0", name="moon_capabilities_version_positive_chk"),
        sa.CheckConstraint("status IN ('active','deprecated')", name="moon_capabilities_status_chk"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_moon_capabilities_galaxy_id_galaxies"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_moon_capabilities_created_by_users"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moon_capabilities_galaxy_id", "moon_capabilities", ["galaxy_id"], unique=False)
    op.create_index("ix_moon_capabilities_table_id", "moon_capabilities", ["table_id"], unique=False)
    op.create_index(
        "ux_moon_capabilities_active_key",
        "moon_capabilities",
        ["galaxy_id", "table_id", "capability_key"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_moon_capabilities_active_key", table_name="moon_capabilities")
    op.drop_index("ix_moon_capabilities_table_id", table_name="moon_capabilities")
    op.drop_index("ix_moon_capabilities_galaxy_id", table_name="moon_capabilities")
    op.drop_table("moon_capabilities")
