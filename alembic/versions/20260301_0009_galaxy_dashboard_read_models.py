"""add galaxy dashboard read-model tables

Revision ID: 20260301_0009
Revises: 20260301_0008
Create Date: 2026-03-01 18:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260301_0009"
down_revision = "20260301_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "galaxy_summary_rm",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("constellations_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("planets_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("moons_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("bonds_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("formula_fields_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_galaxy_summary_rm_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_galaxy_summary_rm_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id", name="pk_galaxy_summary_rm"),
    )
    op.create_index("ix_galaxy_summary_rm_updated_at", "galaxy_summary_rm", ["updated_at"], unique=False)

    op.create_table(
        "galaxy_health_rm",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guardian_rules_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("alerted_civilizations_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("circular_fields_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("quality_score", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'GREEN'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_galaxy_health_rm_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_galaxy_health_rm_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id", name="pk_galaxy_health_rm"),
    )
    op.create_index("ix_galaxy_health_rm_updated_at", "galaxy_health_rm", ["updated_at"], unique=False)

    op.create_table(
        "galaxy_activity_rm",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_seq", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("happened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_galaxy_activity_rm_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_galaxy_activity_rm_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("id", name="pk_galaxy_activity_rm"),
    )
    op.create_index("ix_galaxy_activity_rm_user_id", "galaxy_activity_rm", ["user_id"], unique=False)
    op.create_index("ix_galaxy_activity_rm_galaxy_id", "galaxy_activity_rm", ["galaxy_id"], unique=False)
    op.create_index("ix_galaxy_activity_rm_event_id", "galaxy_activity_rm", ["event_id"], unique=True)
    op.create_index("ix_galaxy_activity_rm_event_seq", "galaxy_activity_rm", ["event_seq"], unique=False)
    op.create_index("ix_galaxy_activity_rm_event_type", "galaxy_activity_rm", ["event_type"], unique=False)
    op.create_index("ix_galaxy_activity_rm_entity_id", "galaxy_activity_rm", ["entity_id"], unique=False)
    op.create_index("ix_galaxy_activity_rm_happened_at", "galaxy_activity_rm", ["happened_at"], unique=False)
    op.create_index("ix_galaxy_activity_rm_created_at", "galaxy_activity_rm", ["created_at"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_galaxy_summary_rm_no_delete
        BEFORE DELETE ON galaxy_summary_rm
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_galaxy_health_rm_no_delete
        BEFORE DELETE ON galaxy_health_rm
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_galaxy_activity_rm_no_delete
        BEFORE DELETE ON galaxy_activity_rm
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_galaxy_activity_rm_no_delete ON galaxy_activity_rm")
    op.execute("DROP TRIGGER IF EXISTS trg_galaxy_health_rm_no_delete ON galaxy_health_rm")
    op.execute("DROP TRIGGER IF EXISTS trg_galaxy_summary_rm_no_delete ON galaxy_summary_rm")

    op.drop_index("ix_galaxy_activity_rm_created_at", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_happened_at", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_entity_id", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_event_type", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_event_seq", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_event_id", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_galaxy_id", table_name="galaxy_activity_rm")
    op.drop_index("ix_galaxy_activity_rm_user_id", table_name="galaxy_activity_rm")
    op.drop_table("galaxy_activity_rm")

    op.drop_index("ix_galaxy_health_rm_updated_at", table_name="galaxy_health_rm")
    op.drop_table("galaxy_health_rm")

    op.drop_index("ix_galaxy_summary_rm_updated_at", table_name="galaxy_summary_rm")
    op.drop_table("galaxy_summary_rm")
