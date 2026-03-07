from __future__ import annotations

from app.schema_models.auth_onboarding import GalaxyPublic, OnboardingMachinePublic, OnboardingPublic
from app.schema_models.branch_contracts import BranchPublic
from app.schema_models.dashboard import MoonSummaryPublic
from app.schema_models.execution import AsteroidResponse
from app.schema_models.universe import MineralFact, MoonRowContract, UniverseAsteroidSnapshot, UniverseTableSnapshot


def _fields(model: type) -> list[str]:
    return list(model.model_fields.keys())


def test_galaxy_workspace_public_shapes_are_frozen() -> None:
    assert _fields(GalaxyPublic) == [
        "id",
        "name",
        "owner_id",
        "created_at",
        "deleted_at",
    ]
    assert _fields(BranchPublic) == [
        "id",
        "galaxy_id",
        "name",
        "base_event_id",
        "created_by",
        "created_at",
        "deleted_at",
    ]
    assert _fields(OnboardingMachinePublic) == [
        "step",
        "intro_ack",
        "planet_dropped",
        "schema_confirmed",
        "dependencies_confirmed",
        "calculations_confirmed",
        "simulation_confirmed",
        "completed",
    ]
    assert _fields(OnboardingPublic) == [
        "user_id",
        "galaxy_id",
        "mode",
        "current_stage_key",
        "current_stage_order",
        "started_at",
        "stage_started_at",
        "completed_at",
        "updated_at",
        "can_advance",
        "advance_blockers",
        "capabilities",
        "machine",
        "metrics",
        "stages",
    ]


def test_civilization_moon_mineral_payload_shapes_are_frozen() -> None:
    assert _fields(AsteroidResponse) == [
        "id",
        "value",
        "metadata",
        "is_deleted",
        "created_at",
        "deleted_at",
        "current_event_seq",
    ]
    assert _fields(UniverseAsteroidSnapshot) == [
        "id",
        "value",
        "table_id",
        "table_name",
        "constellation_name",
        "planet_name",
        "metadata",
        "calculated_values",
        "calc_errors",
        "error_count",
        "circular_fields_count",
        "active_alerts",
        "physics",
        "facts",
        "created_at",
        "current_event_seq",
    ]
    assert _fields(MineralFact) == [
        "key",
        "typed_value",
        "value_type",
        "source",
        "status",
        "unit",
        "readonly",
        "errors",
    ]
    assert _fields(MoonRowContract) == [
        "moon_id",
        "label",
        "planet_id",
        "constellation_name",
        "planet_name",
        "created_at",
        "current_event_seq",
        "state",
        "health_score",
        "violation_count",
        "last_violation_at",
        "active_alerts",
        "facts",
    ]
    assert _fields(MoonSummaryPublic) == [
        "asteroid_id",
        "label",
        "table_id",
        "table_name",
        "constellation_name",
        "planet_name",
        "metadata_fields_count",
        "calculated_fields_count",
        "guardian_rules_count",
        "active_alerts_count",
        "circular_fields_count",
        "quality_score",
        "status",
        "created_at",
    ]
    assert _fields(UniverseTableSnapshot) == [
        "table_id",
        "galaxy_id",
        "name",
        "constellation_name",
        "planet_name",
        "archetype",
        "contract_version",
        "schema_fields",
        "formula_fields",
        "members",
        "internal_bonds",
        "external_bonds",
        "sector",
    ]
