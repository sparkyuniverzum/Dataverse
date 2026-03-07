"""rename_asteroid_id_in_calc_state_rm

Revision ID: c6c1577901aa
Revises: c54a9ee3e096
Create Date: 2026-03-07 20:49:16.880380

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = 'c6c1577901aa'
down_revision = 'c54a9ee3e096'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop primary key constraint before rename
    op.drop_constraint("pk_calc_state_rm", "calc_state_rm", type_="primary")
    op.drop_constraint("fk_calc_state_rm_asteroid_id_atoms", "calc_state_rm", type_="foreignkey")

    op.alter_column("calc_state_rm", "asteroid_id", new_column_name="civilization_id")

    op.create_foreign_key(
        "fk_calc_state_rm_civilization_id_civilization_rm",
        "calc_state_rm",
        "civilization_rm",
        ["civilization_id"],
        ["id"],
    )
    op.create_primary_key("pk_calc_state_rm", "calc_state_rm", ["user_id", "galaxy_id", "civilization_id"])


def downgrade() -> None:
    op.drop_constraint("pk_calc_state_rm", "calc_state_rm", type_="primary")
    op.drop_constraint("fk_calc_state_rm_civilization_id_civilization_rm", "calc_state_rm", type_="foreignkey")

    op.alter_column("calc_state_rm", "civilization_id", new_column_name="asteroid_id")

    op.create_foreign_key(
        "fk_calc_state_rm_asteroid_id_atoms",
        "calc_state_rm",
        "civilization_rm",
        ["asteroid_id"],
        ["id"],
    )
    op.create_primary_key("pk_calc_state_rm", "calc_state_rm", ["user_id", "galaxy_id", "asteroid_id"])
