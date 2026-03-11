from __future__ import annotations

# Backward-compatible facade: keep `app.models` import path stable while
# SQLAlchemy models are organized by canonical ontology domains.
from app.domains.auth.models import AuthSession
from app.domains.bonds.models import Bond
from app.domains.branches.models import Branch
from app.domains.civilizations.models import CivilizationRM
from app.domains.galaxies.models import (
    Galaxy,
    GalaxyActivityRM,
    GalaxyHealthRM,
    GalaxySummaryRM,
    OnboardingProgress,
)
from app.domains.imports.models import ImportError, ImportJob
from app.domains.moons.models import MoonCapability
from app.domains.planets.models import TableContract
from app.domains.shared.base import Base
from app.domains.shared.models import Event, IdempotencyRecord, OutboxEvent
from app.domains.star_core.models import CalcStateRM, PhysicsStateRM, StarCorePolicyRM, User

__all__ = [
    "AuthSession",
    "Base",
    "Bond",
    "Branch",
    "CalcStateRM",
    "CivilizationRM",
    "Event",
    "Galaxy",
    "GalaxyActivityRM",
    "GalaxyHealthRM",
    "GalaxySummaryRM",
    "IdempotencyRecord",
    "ImportError",
    "ImportJob",
    "MoonCapability",
    "OnboardingProgress",
    "OutboxEvent",
    "PhysicsStateRM",
    "StarCorePolicyRM",
    "TableContract",
    "User",
]
