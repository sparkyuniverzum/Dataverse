from __future__ import annotations

import inspect
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.domains.auth import (
    commands as auth_commands,
    models as auth_models,
    queries as auth_queries,
    schemas as auth_schemas,
)
from app.domains.bonds import (
    commands as bond_commands,
    models as bond_models,
    queries as bond_queries,
    schemas as bond_schemas,
)
from app.domains.branches import (
    commands as branch_commands,
    models as branch_models,
    queries as branch_queries,
    schemas as branch_schemas,
)
from app.domains.civilizations import (
    commands as civilization_commands,
    models as civilization_models,
    queries as civilization_queries,
    schemas as civilization_schemas,
)
from app.domains.galaxies import (
    commands as galaxy_commands,
    models as galaxy_models,
    queries as galaxy_queries,
    schemas as galaxy_schemas,
)
from app.domains.imports import (
    commands as import_commands,
    models as import_models,
    queries as import_queries,
    schemas as import_schemas,
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
from app.domains.shared import (
    commands as shared_commands,
    models as shared_models,
    queries as shared_queries,
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


def test_branches_domain_professional_setup() -> None:
    assert branch_models.Branch.__tablename__ == "branches"

    required_schema_names = (
        "BranchCreateRequest",
        "BranchPublic",
        "BranchPromoteResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(branch_schemas, schema_name), f"Missing branches schema `{schema_name}`"

    assert hasattr(branch_commands, "BranchCommandPlan")
    assert hasattr(branch_commands, "BranchCommandError")
    assert hasattr(branch_commands, "plan_create_branch")
    assert hasattr(branch_commands, "plan_promote_branch")
    assert hasattr(branch_queries, "BranchQueryError")
    assert hasattr(branch_queries, "BranchQueryNotFoundError")
    assert hasattr(branch_queries, "BranchQueryConflictError")
    assert hasattr(branch_queries, "BranchQueryForbiddenError")
    assert hasattr(branch_queries, "list_branches")

    create_plan = branch_commands.plan_create_branch(
        galaxy_id=uuid4(),
        name="  timeline-main  ",
        as_of=None,
    )
    assert create_plan.request_payload["name"] == "  timeline-main  "

    promote_plan = branch_commands.plan_promote_branch(
        branch_id=uuid4(),
        galaxy_id=uuid4(),
    )
    assert "branch_id" in promote_plan.request_payload
    assert "galaxy_id" in promote_plan.request_payload

    models_source = inspect.getsource(branch_models)
    schemas_source = inspect.getsource(branch_schemas)
    commands_source = inspect.getsource(branch_commands)
    queries_source = inspect.getsource(branch_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="branches.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="branches.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="branches.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="branches.queries")
    _assert_query_module_is_read_only(queries_source, module_name="branches.queries")


def test_galaxies_domain_professional_setup() -> None:
    assert galaxy_models.Galaxy.__tablename__ == "galaxies"
    assert galaxy_models.OnboardingProgress.__tablename__ == "onboarding_progress"
    assert galaxy_models.GalaxySummaryRM.__tablename__ == "galaxy_summary_rm"
    assert galaxy_models.GalaxyHealthRM.__tablename__ == "galaxy_health_rm"
    assert galaxy_models.GalaxyActivityRM.__tablename__ == "galaxy_activity_rm"

    required_schema_names = (
        "GalaxyPublic",
        "GalaxyCreateRequest",
        "OnboardingPublic",
        "OnboardingUpdateRequest",
        "GalaxySummaryPublic",
        "GalaxyHealthPublic",
        "GalaxyActivityResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(galaxy_schemas, schema_name), f"Missing galaxies schema `{schema_name}`"

    assert hasattr(galaxy_commands, "GalaxyCommandPlan")
    assert hasattr(galaxy_commands, "GalaxyCommandError")
    assert hasattr(galaxy_commands, "plan_create_galaxy")
    assert hasattr(galaxy_commands, "plan_extinguish_galaxy")
    assert hasattr(galaxy_commands, "plan_update_onboarding")
    assert hasattr(galaxy_queries, "GalaxyQueryError")
    assert hasattr(galaxy_queries, "GalaxyQueryNotFoundError")
    assert hasattr(galaxy_queries, "GalaxyQueryConflictError")
    assert hasattr(galaxy_queries, "GalaxyQueryForbiddenError")
    assert hasattr(galaxy_queries, "list_galaxies")
    assert hasattr(galaxy_queries, "resolve_user_galaxy")
    assert hasattr(galaxy_queries, "resolve_galaxy_scope")

    create_plan = galaxy_commands.plan_create_galaxy(name="  New Primary Galaxy  ")
    assert create_plan.request_payload["name"] == "  New Primary Galaxy  "

    extinguish_plan = galaxy_commands.plan_extinguish_galaxy(
        galaxy_id=uuid4(),
        expected_event_seq=12,
    )
    assert "galaxy_id" in extinguish_plan.request_payload
    assert extinguish_plan.request_payload["expected_event_seq"] == 12

    onboarding_plan = galaxy_commands.plan_update_onboarding(
        action="sync_machine",
        mode=None,
        machine={"step": "schema", "planet_dropped": True},
    )
    assert onboarding_plan.request_payload["action"] == "sync_machine"
    assert onboarding_plan.request_payload["machine"] == {"step": "schema", "planet_dropped": True}

    models_source = inspect.getsource(galaxy_models)
    schemas_source = inspect.getsource(galaxy_schemas)
    commands_source = inspect.getsource(galaxy_commands)
    queries_source = inspect.getsource(galaxy_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="galaxies.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="galaxies.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="galaxies.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="galaxies.queries")
    _assert_query_module_is_read_only(queries_source, module_name="galaxies.queries")


def test_imports_domain_professional_setup() -> None:
    assert import_models.ImportJob.__tablename__ == "import_jobs"
    assert import_models.ImportError.__tablename__ == "import_errors"

    required_schema_names = (
        "ImportModeSchema",
        "ImportStatusSchema",
        "ImportJobPublic",
        "ImportErrorPublic",
        "ImportRunResponse",
        "ImportErrorsResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(import_schemas, schema_name), f"Missing imports schema `{schema_name}`"

    assert hasattr(import_commands, "ImportCommandPlan")
    assert hasattr(import_commands, "ImportCommandError")
    assert hasattr(import_commands, "ensure_csv_filename")
    assert hasattr(import_commands, "ensure_non_empty_payload")
    assert hasattr(import_commands, "ensure_csv_export_format")
    assert hasattr(import_commands, "ensure_import_mode")
    assert hasattr(import_commands, "plan_import_csv")
    assert hasattr(import_commands, "run_import_csv")

    assert hasattr(import_queries, "ImportQueryError")
    assert hasattr(import_queries, "ImportQueryNotFoundError")
    assert hasattr(import_queries, "ImportQueryConflictError")
    assert hasattr(import_queries, "ImportQueryForbiddenError")
    assert hasattr(import_queries, "get_job_for_user")
    assert hasattr(import_queries, "get_job_errors")
    assert hasattr(import_queries, "export_snapshot_csv")
    assert hasattr(import_queries, "export_tables_csv")

    assert import_commands.ensure_csv_filename("  universe.csv  ") == "universe.csv"
    assert import_commands.ensure_non_empty_payload(b"row\n") == b"row\n"
    assert import_commands.ensure_csv_export_format("CSV") == "csv"
    assert import_commands.ensure_import_mode("COMMIT") == "commit"

    import_plan = import_commands.plan_import_csv(
        filename="universe.csv",
        mode="commit",
        strict=True,
        galaxy_id=uuid4(),
        branch_id=uuid4(),
    )
    assert import_plan.request_payload["filename"] == "universe.csv"
    assert import_plan.request_payload["mode"] == "commit"
    assert import_plan.request_payload["strict"] is True

    models_source = inspect.getsource(import_models)
    schemas_source = inspect.getsource(import_schemas)
    commands_source = inspect.getsource(import_commands)
    queries_source = inspect.getsource(import_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="imports.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="imports.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="imports.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="imports.queries")
    _assert_query_module_is_read_only(queries_source, module_name="imports.queries")


def test_shared_domain_is_infrastructure_only() -> None:
    assert auth_models.AuthSession.__tablename__ == "auth_sessions"
    assert branch_models.Branch.__tablename__ == "branches"
    assert import_models.ImportJob.__tablename__ == "import_jobs"
    assert import_models.ImportError.__tablename__ == "import_errors"

    assert shared_models.Event.__tablename__ == "events"
    assert shared_models.OutboxEvent.__tablename__ == "event_outbox"
    assert shared_models.IdempotencyRecord.__tablename__ == "idempotency_records"

    assert not hasattr(shared_models, "AuthSession")
    assert not hasattr(shared_models, "Branch")
    assert not hasattr(shared_models, "ImportJob")
    assert not hasattr(shared_models, "ImportError")

    assert hasattr(shared_commands, "SharedCommandPlan")
    assert hasattr(shared_commands, "SharedCommandError")
    assert hasattr(shared_commands, "build_idempotency_request_hash")
    assert hasattr(shared_commands, "check_idempotency_replay")
    assert hasattr(shared_commands, "store_idempotency_response")
    assert hasattr(shared_commands, "append_event")
    assert hasattr(shared_commands, "append_outbox_event")

    assert hasattr(shared_queries, "SharedQueryError")
    assert hasattr(shared_queries, "SharedQueryNotFoundError")
    assert hasattr(shared_queries, "SharedQueryConflictError")
    assert hasattr(shared_queries, "SharedQueryForbiddenError")
    assert hasattr(shared_queries, "latest_event_seq")
    assert hasattr(shared_queries, "list_events_after")
    assert hasattr(shared_queries, "list_events")
    assert hasattr(shared_queries, "list_outbox_events")

    auth_models_source = inspect.getsource(auth_models)
    branch_models_source = inspect.getsource(branch_models)
    import_models_source = inspect.getsource(import_models)
    shared_models_source = inspect.getsource(shared_models)
    shared_commands_source = inspect.getsource(shared_commands)
    shared_queries_source = inspect.getsource(shared_queries)
    _assert_domain_module_is_web_independent(auth_models_source, module_name="auth.models")
    _assert_domain_module_is_web_independent(branch_models_source, module_name="branches.models")
    _assert_domain_module_is_web_independent(import_models_source, module_name="imports.models")
    _assert_domain_module_is_web_independent(shared_models_source, module_name="shared.models")
    _assert_domain_module_is_web_independent(shared_commands_source, module_name="shared.commands")
    _assert_domain_module_is_web_independent(shared_queries_source, module_name="shared.queries")
    _assert_query_module_is_read_only(shared_queries_source, module_name="shared.queries")


def test_auth_domain_professional_setup() -> None:
    assert auth_models.AuthSession.__tablename__ == "auth_sessions"

    required_schema_names = (
        "RegisterRequest",
        "LoginRequest",
        "RefreshRequest",
        "AuthResponse",
        "RefreshResponse",
        "LogoutResponse",
    )
    for schema_name in required_schema_names:
        assert hasattr(auth_schemas, schema_name), f"Missing auth schema `{schema_name}`"

    assert hasattr(auth_commands, "AuthCommandPlan")
    assert hasattr(auth_commands, "AuthCommandError")
    assert hasattr(auth_commands, "plan_register")
    assert hasattr(auth_commands, "plan_login")
    assert hasattr(auth_commands, "plan_refresh")
    assert hasattr(auth_commands, "plan_logout")
    assert hasattr(auth_queries, "AuthContextResult")
    assert hasattr(auth_queries, "AuthQueryError")
    assert hasattr(auth_queries, "decode_access_token")
    assert hasattr(auth_queries, "resolve_auth_context")
    assert hasattr(auth_queries, "get_user_from_context")

    register_plan = auth_commands.plan_register(
        email="operator@dataverse.local",
        password="safe-password",
        galaxy_name="Main Galaxy",
    )
    assert register_plan.request_payload["email"] == "operator@dataverse.local"
    assert register_plan.request_payload["galaxy_name"] == "Main Galaxy"

    login_plan = auth_commands.plan_login(
        email="operator@dataverse.local",
        password="safe-password",
    )
    assert login_plan.request_payload["email"] == "operator@dataverse.local"

    refresh_plan = auth_commands.plan_refresh(refresh_token="refresh-token")
    assert refresh_plan.request_payload["refresh_token"] == "refresh-token"

    logout_plan = auth_commands.plan_logout(session_id=uuid4(), reason="logout")
    assert logout_plan.request_payload["reason"] == "logout"

    refresh_response = auth_schemas.RefreshResponse(
        access_token="access",
        refresh_token="refresh",
        expires_at=datetime.now(UTC),
    )
    assert refresh_response.token_type == "bearer"

    models_source = inspect.getsource(auth_models)
    schemas_source = inspect.getsource(auth_schemas)
    commands_source = inspect.getsource(auth_commands)
    queries_source = inspect.getsource(auth_queries)
    _assert_domain_module_is_web_independent(models_source, module_name="auth.models")
    _assert_domain_module_is_web_independent(schemas_source, module_name="auth.schemas")
    _assert_domain_module_is_web_independent(commands_source, module_name="auth.commands")
    _assert_domain_module_is_web_independent(queries_source, module_name="auth.queries")
    _assert_query_module_is_read_only(queries_source, module_name="auth.queries")


def test_star_core_domain_professional_setup() -> None:
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


def test_runtime_cross_cutting_utilities_use_infrastructure_paths() -> None:
    repo_root = Path(__file__).resolve().parents[1]

    removed_service_shims = (
        repo_root / "app/services/circuit_breaker.py",
        repo_root / "app/services/logging_helpers.py",
        repo_root / "app/services/telemetry_spans.py",
        repo_root / "app/services/trace_context.py",
        repo_root / "app/services/parser_service.py",
        repo_root / "app/services/task_executor_service.py",
    )
    for path in removed_service_shims:
        assert not path.exists(), f"Legacy compatibility shim still exists: {path.relative_to(repo_root)}"

    forbidden_import_tokens = (
        "from app.services.circuit_breaker import",
        "from app.services.logging_helpers import",
        "from app.services.telemetry_spans import",
        "from app.services.trace_context import",
        "from app.services.parser_service import",
        "from app.services.task_executor_service import",
        "import app.services.circuit_breaker",
        "import app.services.logging_helpers",
        "import app.services.telemetry_spans",
        "import app.services.trace_context",
        "import app.services.parser_service",
        "import app.services.task_executor_service",
    )
    for python_path in (repo_root / "app").rglob("*.py"):
        source = python_path.read_text(encoding="utf-8")
        for token in forbidden_import_tokens:
            assert (
                token not in source
            ), f"Legacy runtime import `{token}` remains in {python_path.relative_to(repo_root)}"


def test_core_facades_use_explicit_module_proxies_without_path_hacks() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    parser2_init = (repo_root / "app/core/parser2/__init__.py").read_text(encoding="utf-8")
    task_executor_init = (repo_root / "app/core/task_executor/__init__.py").read_text(encoding="utf-8")

    forbidden_tokens = (
        "__path__.append(",
        "Path(__file__)",
        "resolve().parents",
    )
    for token in forbidden_tokens:
        assert token not in parser2_init, f"Parser2 facade still uses dynamic path hack token `{token}`"
        assert token not in task_executor_init, f"Task executor facade still uses dynamic path hack token `{token}`"
