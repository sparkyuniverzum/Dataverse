"""rename_atoms_to_civilization_rm

Revision ID: c54a9ee3e096
Revises: 20260306_0020
Create Date: 2026-03-07 20:23:35.136977

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = 'c54a9ee3e096'
down_revision = '20260306_0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename table 'atoms' to 'civilization_rm'
    op.rename_table("atoms", "civilization_rm")

    # 2. Rename the constraints and trigger on civilization_rm
    op.execute("ALTER TABLE civilization_rm RENAME CONSTRAINT atoms_soft_delete_chk TO civilization_rm_soft_delete_chk")
    op.execute("ALTER TABLE civilization_rm RENAME CONSTRAINT atoms_pkey TO civilization_rm_pkey")
    op.execute("ALTER TRIGGER trg_atoms_no_delete ON civilization_rm RENAME TO trg_civilization_rm_no_delete")

    # 3. Drop existing index on 'bonds' before renaming columns
    op.drop_index("ux_bonds_active_relation", table_name="bonds")

    # 4. Drop old foreign keys from 'bonds'
    op.drop_constraint("bonds_source_id_fkey", "bonds", type_="foreignkey")
    op.drop_constraint("bonds_target_id_fkey", "bonds", type_="foreignkey")

    # 5. Rename columns in 'bonds'
    op.alter_column("bonds", "source_id", new_column_name="source_civilization_id")
    op.alter_column("bonds", "target_id", new_column_name="target_civilization_id")

    # 6. Recreate foreign keys to point to the renamed columns and table
    op.create_foreign_key(
        "bonds_source_civilization_id_fkey", "bonds", "civilization_rm", ["source_civilization_id"], ["id"]
    )
    op.create_foreign_key(
        "bonds_target_civilization_id_fkey", "bonds", "civilization_rm", ["target_civilization_id"], ["id"]
    )

    # 7. Recreate the unique index with new column names
    op.create_index(
        "ux_bonds_active_relation",
        "bonds",
        ["user_id", "galaxy_id", "source_civilization_id", "target_civilization_id", "type"],
        unique=True,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )


def downgrade() -> None:
    # Reverse of upgrade()
    op.drop_index("ux_bonds_active_relation", table_name="bonds")

    op.drop_constraint("bonds_source_civilization_id_fkey", "bonds", type_="foreignkey")
    op.drop_constraint("bonds_target_civilization_id_fkey", "bonds", type_="foreignkey")

    op.alter_column("bonds", "source_civilization_id", new_column_name="source_id")
    op.alter_column("bonds", "target_civilization_id", new_column_name="target_id")

    op.create_foreign_key("bonds_source_id_fkey", "bonds", "atoms", ["source_id"], ["id"])
    op.create_foreign_key("bonds_target_id_fkey", "bonds", "atoms", ["target_id"], ["id"])

    op.create_index(
        "ux_bonds_active_relation",
        "bonds",
        ["user_id", "galaxy_id", "source_id", "target_id", "type"],
        unique=True,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )

    op.execute("ALTER TRIGGER trg_civilization_rm_no_delete ON civilization_rm RENAME TO trg_atoms_no_delete")
    op.execute("ALTER TABLE civilization_rm RENAME CONSTRAINT civilization_rm_pkey TO atoms_pkey")
    op.execute("ALTER TABLE civilization_rm RENAME CONSTRAINT civilization_rm_soft_delete_chk TO atoms_soft_delete_chk")

    op.rename_table("civilization_rm", "atoms")
