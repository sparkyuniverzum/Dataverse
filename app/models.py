from __future__ import annotations

# Backward-compatible facade: keep `app.models` import path stable while
# SQLAlchemy models are organized by canonical ontology domains.
from app.domains.bonds.models import Bond
from app.domains.civilizations.models import CivilizationRM
from app.domains.moons import MoonCapability
from app.domains.planets import TableContract
from app.domains.shared import (
    AuthSession,
    Base,
    Branch,
    Event,
    IdempotencyRecord,
    ImportError,
    ImportJob,
    OutboxEvent,
)
from app.domains.star_core import (
    CalcStateRM,
    Galaxy,
    GalaxyActivityRM,
    GalaxyHealthRM,
    GalaxySummaryRM,
    OnboardingProgress,
    PhysicsStateRM,
    StarCorePolicyRM,
    User,
)

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
