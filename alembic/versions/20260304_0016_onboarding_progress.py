"""add onboarding progress table

Revision ID: 20260304_0016
Revises: 20260303_0015
Create Date: 2026-03-04 19:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260304_0016"
down_revision = "20260303_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "onboarding_progress",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.Text(), nullable=False, server_default=sa.text("'guided'")),
        sa.Column("stage_key", sa.Text(), nullable=False, server_default=sa.text("'galaxy_bootstrap'")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("stage_started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "notes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_onboarding_progress_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_onboarding_progress_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("user_id", "galaxy_id", name="pk_onboarding_progress"),
    )

    op.create_index("ix_onboarding_progress_updated_at", "onboarding_progress", ["updated_at"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_onboarding_progress_no_delete
        BEFORE DELETE ON onboarding_progress
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_onboarding_progress_no_delete ON onboarding_progress")
    op.drop_index("ix_onboarding_progress_updated_at", table_name="onboarding_progress")
    op.drop_table("onboarding_progress")
