from __future__ import annotations

import inspect
from uuid import uuid4

from app.domains.bonds import (
    commands as bond_commands,
    models as bond_models,
    queries as bond_queries,
    schemas as bond_schemas,
)
from app.domains.civilizations import (
    commands as civilization_commands,
    models as civilization_models,
    queries as civilization_queries,
    schemas as civilization_schemas,
)
from app.domains.moons import (
    commands as moon_commands,
    models as moon_models,
    queries as moon_queries,
    schemas as moon_schemas,
)
from app.domains.planets import (
    commands as planet_commands,
    models as planet_models,
    queries as planet_queries,
    schemas as planet_schemas,
)
from app.domains.star_core import (
    commands as star_core_commands,
    models as star_core_models,
    queries as star_core_queries,
    schemas as star_core_schemas,
)


def _assert_domain_module_is_web_independent(source: str, *, module_name: str) -> None:
    forbidden_tokens = (
        "from fastapi",
        "import fastapi",
        "APIRouter",
        "from app.api",
        "import app.api",
    )
    for token in forbidden_tokens:
        assert token not in source, f"{module_name} leaks web-layer dependency via `{token}`"


def _assert_query_module_is_read_only(source: str, *, module_name: str) -> None:
    forbidden_tokens = (
        "session.add(",
        "session.delete(",
        "session.commit(",
        "session.flush(",
        "insert(",
        "update(",
        "delete(",
    )
    for token in forbidden_tokens:
        assert token not in source, f"{module_name} contains write-side token `{token}` in query layer"


def test_civilizations_domain_professional_setup() -> None:
    assert civilization_models.CivilizationRM.__tablename__ == "civilization_rm"

    assert hasattr(civilization_schemas, "CivilizationCreateRequest")
    assert hasattr(civilization_schemas, "CivilizationListResponse")
    assert hasattr(civilization_schemas, "CivilizationRowContract")
    assert hasattr(civilization_schemas, "CivilizationResponse")

    ingest_plan = civilization_commands.plan_ingest_civilization(value="seed", metadata={"state": "active"})
    assert ingest_plan.tasks and ingest_plan.tasks[0].action == "INGEST"

    mutate_plan = civilization_commands.plan_mutate_civilization(
        civilization_id=uuid4(),
        value="updated",
        metadata={"state": "archived"},
        expected_event_seq=3,
    )
    assert mutate_plan.tasks and mutate_plan.tasks[0].action == "UPDATE_ASTEROID"
    assert mutate_plan.tasks[0].params.get("expected_event_seq") == 3

    extinguish_plan = civilization_commands.plan_extinguish_civilization(
        civilization_id=uuid4(),
        expected_event_seq=4,
    )
    assert extinguish_plan.tasks and extinguish_plan.tasks[0].action == "EXTINGUISH"

    mineral_plan = civilization_commands.plan_mineral_mutation(
        civilization_id=uuid4(),
        mineral_key="segment",
        typed_value="enterprise",
        remove=False,
        expected_event_seq=5,
    )
    assert mineral_plan.tasks and mineral_plan.tasks[0].action == "UPDATE_ASTEROID"

    commands_source = inspect.getsource(civilization_commands)
    queries_source = inspect.getsource(civilization_queries)

    _assert_domain_module_is_web_independent(commands_source, module_name="civilizations.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="civilizations.queries")
    _assert_query_module_is_read_only(queries_source, module_name="civilizations.queries")

    assert hasattr(civilization_queries, "CivilizationQueryNotFoundError")
    assert hasattr(civilization_queries, "CivilizationQueryConflictError")


def test_bonds_domain_professional_setup() -> None:
    assert bond_models.Bond.__tablename__ == "bonds"

    assert hasattr(bond_schemas, "BondCreateRequest")
    assert hasattr(bond_schemas, "BondMutateRequest")
    assert hasattr(bond_schemas, "BondValidateRequest")
    assert hasattr(bond_schemas, "BondResponse")

    link_plan = bond_commands.plan_link_bond(
        source_civilization_id=uuid4(),
        target_civilization_id=uuid4(),
        bond_type="RELATION",
        expected_source_event_seq=1,
        expected_target_event_seq=2,
    )
    assert link_plan.tasks and link_plan.tasks[0].action == "LINK"
    assert link_plan.tasks[0].params.get("expected_source_event_seq") == 1
    assert link_plan.tasks[0].params.get("expected_target_event_seq") == 2

    mutate_plan = bond_commands.plan_mutate_bond(
        bond_id=uuid4(),
        bond_type="BLOCKS",
        expected_event_seq=7,
    )
    assert mutate_plan.tasks and mutate_plan.tasks[0].action == "UPDATE_BOND"
    assert mutate_plan.tasks[0].params.get("expected_event_seq") == 7

    extinguish_plan = bond_commands.plan_extinguish_bond(
        bond_id=uuid4(),
        expected_event_seq=8,
    )
    assert extinguish_plan.tasks and extinguish_plan.tasks[0].action == "EXTINGUISH_BOND"

    commands_source = inspect.getsource(bond_commands)
    queries_source = inspect.getsource(bond_queries)

    _assert_domain_module_is_web_independent(commands_source, module_name="bonds.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="bonds.queries")
    _assert_query_module_is_read_only(queries_source, module_name="bonds.queries")

    assert hasattr(bond_queries, "validate_bond_request")


def test_moons_capability_domain_professional_setup() -> None:
    assert moon_models.MoonCapability.__tablename__ == "moon_capabilities"

    required_schema_names = (
        "MoonCapabilityCreateRequest",
        "MoonCapabilityUpdateRequest",
        "MoonCapabilityDeprecateRequest",
        "MoonCapabilityPublic",
        "MoonCapabilityListResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(moon_schemas, schema_name), f"Missing moon capability schema `{schema_name}`"

    assert hasattr(moon_commands, "MoonCapabilityCommandPlan")
    assert hasattr(moon_commands, "MoonCapabilityPolicyError")
    assert hasattr(moon_commands, "ensure_main_timeline")
    assert hasattr(moon_queries, "list_planet_capabilities")
    assert hasattr(moon_queries, "MoonCapabilityQueryNotFoundError")
    assert hasattr(moon_queries, "MoonCapabilityQueryConflictError")
    assert hasattr(moon_queries, "MoonCapabilityQueryForbiddenError")

    upsert_plan = moon_commands.plan_upsert_moon_capability(
        planet_id=uuid4(),
        capability_key="quality_gate",
        capability_class="validation",
        config={"threshold": 2},
        order_index=120,
        status="active",
    )
    assert upsert_plan.request_payload["capability_key"] == "quality_gate"
    assert upsert_plan.request_payload["capability_class"] == "validation"
    assert upsert_plan.request_payload["order_index"] == 120

    update_plan = moon_commands.plan_update_moon_capability(
        capability_id=uuid4(),
        capability_class="formula",
        config={"expression": "a+b"},
        order_index=130,
        status="deprecated",
        expected_version=3,
    )
    assert update_plan.request_payload["capability_class"] == "formula"
    assert update_plan.request_payload["expected_version"] == 3

    deprecate_plan = moon_commands.plan_deprecate_moon_capability(
        capability_id=uuid4(),
        expected_version=4,
    )
    assert deprecate_plan.request_payload["expected_version"] == 4

    create_payload = moon_schemas.MoonCapabilityCreateRequest(
        capability_key="  quality_gate  ",
        capability_class="validation",
        config={"threshold": 2},
        idempotency_key="  moon-cap-create  ",
    )
    assert create_payload.capability_key == "quality_gate"
    assert create_payload.idempotency_key == "moon-cap-create"
    assert create_payload.status == "active"

    update_payload = moon_schemas.MoonCapabilityUpdateRequest(
        status="deprecated",
        expected_version=3,
        idempotency_key="  moon-cap-update  ",
    )
    assert update_payload.status == "deprecated"
    assert update_payload.expected_version == 3
    assert update_payload.idempotency_key == "moon-cap-update"

    deprecate_payload = moon_schemas.MoonCapabilityDeprecateRequest(
        expected_version=4,
        idempotency_key="  moon-cap-deprecate  ",
    )
    assert deprecate_payload.expected_version == 4
    assert deprecate_payload.idempotency_key == "moon-cap-deprecate"

    models_source = inspect.getsource(moon_models)
    schemas_source = inspect.getsource(moon_schemas)
    commands_source = inspect.getsource(moon_commands)
    queries_source = inspect.getsource(moon_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="moons.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="moons.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="moons.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="moons.queries")
    _assert_query_module_is_read_only(queries_source, module_name="moons.queries")


def test_planets_domain_professional_setup() -> None:
    assert planet_models.TableContract.__tablename__ == "table_contracts"

    required_schema_names = (
        "PlanetArchetype",
        "PlanetCreateRequest",
        "PlanetCreateResponse",
        "PlanetPublic",
        "PlanetListResponse",
        "PlanetExtinguishResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(planet_schemas, schema_name), f"Missing planets schema `{schema_name}`"

    assert hasattr(planet_commands, "PlanetCommandPlan")
    assert hasattr(planet_commands, "PlanetPolicyError")
    assert hasattr(planet_commands, "ensure_main_timeline")
    assert hasattr(planet_commands, "ensure_planet_empty_for_extinguish")
    assert hasattr(planet_commands, "plan_create_planet")
    assert hasattr(planet_commands, "plan_extinguish_planet")
    assert hasattr(planet_queries, "list_planet_tables")
    assert hasattr(planet_queries, "get_planet_table")
    assert hasattr(planet_queries, "list_latest_planet_contracts")
    assert hasattr(planet_queries, "PlanetQueryNotFoundError")
    assert hasattr(planet_queries, "PlanetQueryConflictError")
    assert hasattr(planet_queries, "PlanetQueryForbiddenError")

    create_plan = planet_commands.plan_create_planet(
        name="Constellation / Planet-Prime",
        archetype="catalog",
        initial_schema_mode="empty",
        schema_preset_key=None,
        seed_rows=True,
        visual_position={"x": 1.0, "y": 2.0, "z": 3.0},
    )
    assert create_plan.request_payload["name"] == "Constellation / Planet-Prime"
    assert create_plan.request_payload["archetype"] == "catalog"
    assert create_plan.request_payload["visual_position"] == {"x": 1.0, "y": 2.0, "z": 3.0}

    extinguish_plan = planet_commands.plan_extinguish_planet(table_id=uuid4())
    assert "table_id" in extinguish_plan.request_payload

    planet_commands.ensure_planet_empty_for_extinguish(
        table_payload={
            "members": [],
            "internal_bonds": [],
            "external_bonds": [],
        }
    )

    models_source = inspect.getsource(planet_models)
    schemas_source = inspect.getsource(planet_schemas)
    commands_source = inspect.getsource(planet_commands)
    queries_source = inspect.getsource(planet_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="planets.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="planets.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="planets.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="planets.queries")
    _assert_query_module_is_read_only(queries_source, module_name="planets.queries")


def test_star_core_domain_professional_setup() -> None:
    assert star_core_models.Galaxy.__tablename__ == "galaxies"
    assert star_core_models.StarCorePolicyRM.__tablename__ == "star_core_policies"

    required_schema_names = (
        "StarCorePolicyPublic",
        "StarCoreProfileApplyRequest",
        "StarCorePhysicsProfileMigrateRequest",
        "StarCoreRuntimePublic",
        "StarCorePulseResponse",
        "StarCoreDomainMetricsResponse",
        "StarCoreOutboxRunOnceRequest",
        "StarCoreOutboxStatusResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(star_core_schemas, schema_name), f"Missing star_core schema `{schema_name}`"

    assert hasattr(star_core_commands, "StarCoreCommandPlan")
    assert hasattr(star_core_commands, "StarCoreCommandError")
    assert hasattr(star_core_commands, "plan_apply_profile_lock")
    assert hasattr(star_core_commands, "plan_migrate_physics_profile")
    assert hasattr(star_core_commands, "plan_outbox_run_once")
    assert hasattr(star_core_queries, "StarCoreQueryError")
    assert hasattr(star_core_queries, "get_policy")
    assert hasattr(star_core_queries, "get_physics_profile")
    assert hasattr(star_core_queries, "get_planet_physics_runtime")
    assert hasattr(star_core_queries, "get_runtime")
    assert hasattr(star_core_queries, "list_pulse")
    assert hasattr(star_core_queries, "get_domain_metrics")
    assert hasattr(star_core_queries, "get_outbox_status_snapshot")

    apply_plan = star_core_commands.plan_apply_profile_lock(
        profile_key="ORIGIN",
        physical_profile_key="BALANCE",
        physical_profile_version=2,
        lock_after_apply=True,
    )
    assert apply_plan.request_payload["profile_key"] == "ORIGIN"
    assert apply_plan.request_payload["physical_profile_key"] == "BALANCE"
    assert apply_plan.request_payload["physical_profile_version"] == 2
    assert apply_plan.request_payload["lock_after_apply"] is True

    migration_plan = star_core_commands.plan_migrate_physics_profile(
        from_version=2,
        to_version=3,
        reason="upgrade coefficients",
        dry_run=True,
    )
    assert migration_plan.request_payload["from_version"] == 2
    assert migration_plan.request_payload["to_version"] == 3
    assert migration_plan.request_payload["dry_run"] is True

    outbox_plan = star_core_commands.plan_outbox_run_once(requeue_limit=64, relay_batch_size=32)
    assert outbox_plan.request_payload["requeue_limit"] == 64
    assert outbox_plan.request_payload["relay_batch_size"] == 32

    models_source = inspect.getsource(star_core_models)
    schemas_source = inspect.getsource(star_core_schemas)
    commands_source = inspect.getsource(star_core_commands)
    queries_source = inspect.getsource(star_core_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="star_core.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="star_core.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="star_core.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="star_core.queries")
    _assert_query_module_is_read_only(queries_source, module_name="star_core.queries")
