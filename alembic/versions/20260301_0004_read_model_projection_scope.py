"""scope read-model tables for event projections

Revision ID: 20260301_0004
Revises: 20260228_0003
Create Date: 2026-03-01 00:00:00
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260301_0004"
down_revision = "20260228_0003"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_LEGACY_GALAXY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def upgrade() -> None:
    op.add_column(
        "civilization_rm",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text(f"'{SYSTEM_USER_ID}'::uuid"),
        ),
    )
    op.add_column(
        "civilization_rm",
        sa.Column(
            "galaxy_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_LEGACY_GALAXY_ID}'::uuid"),
        ),
    )
    op.create_foreign_key("fk_civilization_rm_user_id_users", "civilization_rm", "users", ["user_id"], ["id"])
    op.create_foreign_key(
        "fk_civilization_rm_galaxy_id_galaxies", "civilization_rm", "galaxies", ["galaxy_id"], ["id"]
    )
    op.create_index("ix_civilization_rm_user_id", "civilization_rm", ["user_id"], unique=False)
    op.create_index("ix_civilization_rm_galaxy_id", "civilization_rm", ["galaxy_id"], unique=False)
    op.create_index(
        "ix_civilization_rm_galaxy_is_deleted_created",
        "civilization_rm",
        ["galaxy_id", "is_deleted", "created_at"],
        unique=False,
    )
    op.alter_column("civilization_rm", "user_id", server_default=None)
    op.alter_column("civilization_rm", "galaxy_id", server_default=None)

    op.add_column(
        "bonds",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text(f"'{SYSTEM_USER_ID}'::uuid"),
        ),
    )
    op.add_column(
        "bonds",
        sa.Column(
            "galaxy_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_LEGACY_GALAXY_ID}'::uuid"),
        ),
    )
    op.create_foreign_key("fk_bonds_user_id_users", "bonds", "users", ["user_id"], ["id"])
    op.create_foreign_key("fk_bonds_galaxy_id_galaxies", "bonds", "galaxies", ["galaxy_id"], ["id"])
    op.create_index("ix_bonds_user_id", "bonds", ["user_id"], unique=False)
    op.create_index("ix_bonds_galaxy_id", "bonds", ["galaxy_id"], unique=False)
    op.create_index(
        "ix_bonds_galaxy_is_deleted_created",
        "bonds",
        ["galaxy_id", "is_deleted", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_bonds_galaxy_is_deleted_endpoints",
        "bonds",
        ["galaxy_id", "is_deleted", "source_civilization_id", "target_civilization_id"],
        unique=False,
    )
    op.alter_column("bonds", "user_id", server_default=None)
    op.alter_column("bonds", "galaxy_id", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_bonds_galaxy_is_deleted_endpoints", table_name="bonds")
    op.drop_index("ix_bonds_galaxy_is_deleted_created", table_name="bonds")
    op.drop_index("ix_bonds_galaxy_id", table_name="bonds")
    op.drop_index("ix_bonds_user_id", table_name="bonds")
    op.drop_constraint("fk_bonds_galaxy_id_galaxies", "bonds", type_="foreignkey")
    op.drop_constraint("fk_bonds_user_id_users", "bonds", type_="foreignkey")
    op.drop_column("bonds", "galaxy_id")
    op.drop_column("bonds", "user_id")

    op.drop_index("ix_civilization_rm_galaxy_is_deleted_created", table_name="civilization_rm")
    op.drop_index("ix_civilization_rm_galaxy_id", table_name="civilization_rm")
    op.drop_index("ix_civilization_rm_user_id", table_name="civilization_rm")
    op.drop_constraint("fk_civilization_rm_galaxy_id_galaxies", "civilization_rm", type_="foreignkey")
    op.drop_constraint("fk_civilization_rm_user_id_users", "civilization_rm", type_="foreignkey")
    op.drop_column("civilization_rm", "galaxy_id")
    op.drop_column("civilization_rm", "user_id")
