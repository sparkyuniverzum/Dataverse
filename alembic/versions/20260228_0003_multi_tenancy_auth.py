"""add users, galaxies and tenant isolation for events

Revision ID: 20260228_0003
Revises: 20260228_0002
Create Date: 2026-02-28 00:30:00
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260228_0003"
down_revision = "20260228_0002"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_LEGACY_GALAXY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("hashed_password", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "galaxies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_galaxies_owner_id_users"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_galaxies_owner_id", "galaxies", ["owner_id"], unique=False)

    op.add_column("events", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_events_user_id", "events", ["user_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO users(id, email, hashed_password, is_active)
            VALUES (:user_id, 'system@dataverse.local', '!', FALSE)
            ON CONFLICT (id) DO NOTHING
            """
        ).bindparams(sa.bindparam("user_id", SYSTEM_USER_ID, type_=postgresql.UUID(as_uuid=True)))
    )

    op.execute(
        sa.text(
            """
            INSERT INTO galaxies(id, name, owner_id)
            VALUES (:galaxy_id, 'Legacy Galaxy', :owner_id)
            ON CONFLICT (id) DO NOTHING
            """
        ).bindparams(
            sa.bindparam("galaxy_id", DEFAULT_LEGACY_GALAXY_ID, type_=postgresql.UUID(as_uuid=True)),
            sa.bindparam("owner_id", SYSTEM_USER_ID, type_=postgresql.UUID(as_uuid=True)),
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO galaxies(id, name, owner_id)
            SELECT DISTINCT e.galaxy_id, ('Legacy Galaxy ' || left(e.galaxy_id::text, 8)), :owner_id
            FROM events e
            LEFT JOIN galaxies g ON g.id = e.galaxy_id
            WHERE g.id IS NULL
            """
        ).bindparams(sa.bindparam("owner_id", SYSTEM_USER_ID, type_=postgresql.UUID(as_uuid=True)))
    )

    op.execute(
        sa.text("UPDATE events SET user_id = :user_id WHERE user_id IS NULL").bindparams(
            sa.bindparam("user_id", SYSTEM_USER_ID, type_=postgresql.UUID(as_uuid=True))
        )
    )

    op.alter_column("events", "user_id", nullable=False)
    op.create_foreign_key(
        "fk_events_user_id_users",
        "events",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_events_galaxy_id_galaxies",
        "events",
        "galaxies",
        ["galaxy_id"],
        ["id"],
    )

    op.execute(
        """
        CREATE TRIGGER trg_users_no_delete
        BEFORE DELETE ON users
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_galaxies_no_delete
        BEFORE DELETE ON galaxies
        FOR EACH ROW
        EXECUTE FUNCTION prevent_hard_delete();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_galaxies_no_delete ON galaxies")
    op.execute("DROP TRIGGER IF EXISTS trg_users_no_delete ON users")

    op.drop_constraint("fk_events_galaxy_id_galaxies", "events", type_="foreignkey")
    op.drop_constraint("fk_events_user_id_users", "events", type_="foreignkey")
    op.drop_index("ix_events_user_id", table_name="events")
    op.drop_column("events", "user_id")

    op.drop_index("ix_galaxies_owner_id", table_name="galaxies")
    op.drop_table("galaxies")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
