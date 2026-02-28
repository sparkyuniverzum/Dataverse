"""init atoms and bonds with hard-delete protection

Revision ID: 20260227_0001
Revises:
Create Date: 2026-02-27 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260227_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "atoms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))",
            name="atoms_soft_delete_chk",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "bonds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("source_id <> target_id", name="bonds_no_delete_chk"),
        sa.CheckConstraint(
            "((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))",
            name="bonds_soft_delete_chk",
        ),
        sa.ForeignKeyConstraint(["source_id"], ["atoms.id"]),
        sa.ForeignKeyConstraint(["target_id"], ["atoms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_hard_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'HARD DELETE is forbidden in DataVerse. Use soft-delete.';
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_atoms_no_delete
        BEFORE DELETE ON atoms
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_bonds_no_delete
        BEFORE DELETE ON bonds
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_bonds_no_delete ON bonds")
    op.execute("DROP TRIGGER IF EXISTS trg_atoms_no_delete ON atoms")
    op.execute("DROP FUNCTION IF EXISTS prevent_hard_delete")
    op.drop_table("bonds")
    op.drop_table("atoms")
