"""add cosmos sprint1 branches/contracts and branch-aware events

Revision ID: 20260301_0006
Revises: 20260301_0005
Create Date: 2026-03-01 12:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260301_0006"
down_revision = "20260301_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "branches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("base_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_branches_galaxy_id_galaxies"),
        sa.ForeignKeyConstraint(["base_event_id"], ["events.id"], name="fk_branches_base_event_id_events"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_branches_created_by_users"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_branches_galaxy_id", "branches", ["galaxy_id"], unique=False)
    op.create_index("ix_branches_created_by", "branches", ["created_by"], unique=False)
    op.create_index("ix_branches_created_at", "branches", ["created_at"], unique=False)
    op.create_index("ix_branches_deleted_at", "branches", ["deleted_at"], unique=False)
    op.create_index("ix_branches_galaxy_name", "branches", ["galaxy_id", "name"], unique=False)

    op.create_table(
        "table_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("galaxy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "required_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "field_types",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "unique_rules",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "validators",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("version > 0", name="table_contracts_version_positive_chk"),
        sa.ForeignKeyConstraint(["galaxy_id"], ["galaxies.id"], name="fk_table_contracts_galaxy_id_galaxies"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_table_contracts_created_by_users"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_table_contracts_galaxy_id", "table_contracts", ["galaxy_id"], unique=False)
    op.create_index("ix_table_contracts_table_id", "table_contracts", ["table_id"], unique=False)
    op.create_index("ix_table_contracts_deleted_at", "table_contracts", ["deleted_at"], unique=False)
    op.create_index(
        "ix_table_contracts_galaxy_table_version",
        "table_contracts",
        ["galaxy_id", "table_id", "version"],
        unique=True,
    )

    op.add_column("events", sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_events_branch_id", "events", ["branch_id"], unique=False)
    op.create_index(
        "ix_events_user_galaxy_branch_timestamp",
        "events",
        ["user_id", "galaxy_id", "branch_id", "timestamp"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_events_branch_id_branches",
        "events",
        "branches",
        ["branch_id"],
        ["id"],
    )

    op.execute(
        """
        CREATE TRIGGER trg_branches_no_delete
        BEFORE DELETE ON branches
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_table_contracts_no_delete
        BEFORE DELETE ON table_contracts
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_table_contracts_no_delete ON table_contracts")
    op.execute("DROP TRIGGER IF EXISTS trg_branches_no_delete ON branches")

    op.drop_constraint("fk_events_branch_id_branches", "events", type_="foreignkey")
    op.drop_index("ix_events_user_galaxy_branch_timestamp", table_name="events")
    op.drop_index("ix_events_branch_id", table_name="events")
    op.drop_column("events", "branch_id")

    op.drop_index("ix_table_contracts_galaxy_table_version", table_name="table_contracts")
    op.drop_index("ix_table_contracts_deleted_at", table_name="table_contracts")
    op.drop_index("ix_table_contracts_table_id", table_name="table_contracts")
    op.drop_index("ix_table_contracts_galaxy_id", table_name="table_contracts")
    op.drop_table("table_contracts")

    op.drop_index("ix_branches_galaxy_name", table_name="branches")
    op.drop_index("ix_branches_deleted_at", table_name="branches")
    op.drop_index("ix_branches_created_at", table_name="branches")
    op.drop_index("ix_branches_created_by", table_name="branches")
    op.drop_index("ix_branches_galaxy_id", table_name="branches")
    op.drop_table("branches")
