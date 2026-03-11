from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.services.universe_service import ProjectedBond, ProjectedCivilization


@dataclass
class TaskExecutionResult:
    civilizations: list[ProjectedCivilization] = field(default_factory=list)
    bonds: list[ProjectedBond] = field(default_factory=list)
    selected_asteroids: list[ProjectedCivilization] = field(default_factory=list)
    extinguished_asteroids: list[ProjectedCivilization] = field(default_factory=list)
    extinguished_civilization_ids: list[UUID] = field(default_factory=list)
    extinguished_bond_ids: list[UUID] = field(default_factory=list)
    semantic_effects: list[dict[str, Any]] = field(default_factory=list)
