"""add import job tracking for csv io

Revision ID: 20260301_0005
Revises: 20260301_0004
Create Date: 2026-03-01 00:30:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260301_0005"
down_revision = "20260301_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("file_hash", sa.Text(), nullable=False),
        sa.Column("mode", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("errors_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_import_jobs_user_id_users"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_import_jobs_galaxy_id_galaxies"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_import_jobs_user_id", "import_jobs", ["user_id"], unique=False)
    op.create_index("ix_import_jobs_galaxy_id", "import_jobs", ["galaxy_id"], unique=False)
    op.create_index("ix_import_jobs_file_hash", "import_jobs", ["file_hash"], unique=False)
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"], unique=False)

    op.create_table(
        "import_errors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("column_name", sa.Text(), nullable=True),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["job_id"], ["import_jobs.id"], name="fk_import_errors_job_id_import_jobs"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_import_errors_job_id", "import_errors", ["job_id"], unique=False)

    op.execute(
        """
        CREATE TRIGGER trg_import_jobs_no_delete
        BEFORE DELETE ON import_jobs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_import_errors_no_delete
        BEFORE DELETE ON import_errors
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_import_errors_no_delete ON import_errors")
    op.execute("DROP TRIGGER IF EXISTS trg_import_jobs_no_delete ON import_jobs")
    op.drop_index("ix_import_errors_job_id", table_name="import_errors")
    op.drop_table("import_errors")
    op.drop_index("ix_import_jobs_status", table_name="import_jobs")
    op.drop_index("ix_import_jobs_file_hash", table_name="import_jobs")
    op.drop_index("ix_import_jobs_galaxy_id", table_name="import_jobs")
    op.drop_index("ix_import_jobs_user_id", table_name="import_jobs")
    op.drop_table("import_jobs")
