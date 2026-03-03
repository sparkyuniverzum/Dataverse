"""add physics state read-model table

Revision ID: 20260303_0015
Revises: 20260303_0014
Create Date: 2026-03-03 23:58:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260303_0015"
down_revision = "20260303_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "physics_state_rm",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_kind", sa.Text(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_event_seq", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("engine_version", sa.Text(), nullable=False, server_default=sa.text("'physics-v1'")),
        sa.Column("stress_score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("mass_factor", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column("radius_factor", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column("emissive_boost", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("pulse_factor", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column("opacity_factor", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column("attraction_factor", sa.Float(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_physics_state_rm_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_physics_state_rm_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id", "entity_kind", "entity_id", name="pk_physics_state_rm"),
    )

    op.create_index("ix_physics_state_rm_source_event_seq", "physics_state_rm", ["source_event_seq"], unique=False)
    op.create_index("ix_physics_state_rm_updated_at", "physics_state_rm", ["updated_at"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_physics_state_rm_no_delete
        BEFORE DELETE ON physics_state_rm
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_physics_state_rm_no_delete ON physics_state_rm")
    op.drop_index("ix_physics_state_rm_updated_at", table_name="physics_state_rm")
    op.drop_index("ix_physics_state_rm_source_event_seq", table_name="physics_state_rm")
    op.drop_table("physics_state_rm")
