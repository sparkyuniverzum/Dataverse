from app.services.universe.service_core import UniverseServiceCore
from app.services.universe.service_snapshots import UniverseServiceSnapshots
from app.services.universe.types import (
    DEFAULT_GALAXY_ID,
    ProjectedBond,
    ProjectedCivilization,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)

__all__ = [
    "UniverseService",
    "DEFAULT_GALAXY_ID",
    "ProjectedCivilization",
    "ProjectedBond",
    "derive_table_id",
    "derive_table_name",
    "split_constellation_and_planet_name",
]


class UniverseService(UniverseServiceCore, UniverseServiceSnapshots):
    pass
