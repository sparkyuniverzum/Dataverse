from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.services.universe_service import ProjectedAsteroid, ProjectedBond


@dataclass
class TaskExecutionResult:
    civilizations: list[ProjectedAsteroid] = field(default_factory=list)
    bonds: list[ProjectedBond] = field(default_factory=list)
    selected_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_asteroids: list[ProjectedAsteroid] = field(default_factory=list)
    extinguished_civilization_ids: list[UUID] = field(default_factory=list)
    extinguished_bond_ids: list[UUID] = field(default_factory=list)
    semantic_effects: list[dict[str, Any]] = field(default_factory=list)
