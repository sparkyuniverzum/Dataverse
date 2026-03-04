import asyncio
import json
from collections.abc import Awaitable, Callable, Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal, get_session
from app.models import Branch, Galaxy, ImportError, ImportJob, TableContract, User
from app.schemas import (
    AsteroidIngestRequest,
    AsteroidMutateRequest,
    AsteroidResponse,
    build_moon_facts,
    AuthResponse,
    BranchCreateRequest,
    BranchPromoteResponse,
    BranchPublic,
    BondCreateRequest,
    BondMutateRequest,
    BondSummaryPublic,
    BondSummaryResponse,
    BondResponse,
    ConstellationSummaryPublic,
    ConstellationSummaryResponse,
    GalaxyCreateRequest,
    GalaxyActivityPublic,
    GalaxyActivityResponse,
    GalaxyHealthPublic,
    GalaxyPublic,
    GalaxySummaryPublic,
    ImportErrorsResponse,
    ImportJobPublic,
    ImportModeSchema,
    ImportRunResponse,
    ImportErrorPublic,
    LoginRequest,
    MoonSummaryPublic,
    MoonSummaryResponse,
    OnboardingPublic,
    OnboardingUpdateRequest,
    ParseCommandRequest,
    ParseCommandResponse,
    PlanetSummaryPublic,
    PlanetSummaryResponse,
    PresetBundleApplyPlanetResultPublic,
    PresetBundleApplyRequest,
    PresetBundleApplyResponse,
    PresetBundleExecutionPublic,
    PresetBundleGraphPlanPublic,
    PresetBundleSummaryPublic,
    PresetApplyMode,
    PresetConflictStrategy,
    RegisterRequest,
    SchemaPresetContractPreviewPublic,
    SchemaPresetSeedPlanPublic,
    SchemaPresetApplyDiffPublic,
    TableContractPublic,
    TableContractUpsertRequest,
    TaskSchema,
    TaskBatchExecuteRequest,
    TaskBatchExecuteResponse,
    UniverseAsteroidSnapshot,
    UniverseBondSnapshot,
    UniverseSnapshotResponse,
    UniverseTablesResponse,
    UserPublic,
)
from app.services.auth_service import AuthService, get_current_user
from app.services.bond_dashboard_service import BondDashboardService
from app.services.bond_semantics import bond_semantics
from app.services.cosmos_service import CosmosService
from app.services.constellation_dashboard_service import ConstellationDashboardService
from app.services.event_store_service import EventStoreService
from app.services.galaxy_dashboard_service import GalaxyDashboardService
from app.services.idempotency_service import IdempotencyService
from app.services.io_service import ImportExportService, ImportMode
from app.services.moon_dashboard_service import MoonDashboardService
from app.services.onboarding_service import OnboardingService
from app.services.parser2 import (
    Parser2ExecutorBridge,
    Parser2SemanticPlanner,
    SnapshotSemanticResolver,
    parser_v2_fallback_to_v1_enabled,
)
from app.services.parser_service import AtomicTask, ParserService
from app.services.planet_dashboard_service import PlanetDashboardService
from app.services.preset_bundle_service import PresetBundleService
from app.services.schema_preset_service import SchemaPresetService
from app.services.task_executor_service import TaskExecutionResult, TaskExecutorService
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    UniverseService,
    derive_table_id,
    derive_table_name,
    split_constellation_and_planet_name,
)

app = FastAPI(title="DataVerse API", version="0.3.0-auth-multitenant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

event_store = EventStoreService()
universe_service = UniverseService(event_store=event_store)
parser_service = ParserService()
parser2_planner = Parser2SemanticPlanner()
parser2_executor_bridge = Parser2ExecutorBridge()
task_executor_service = TaskExecutorService(event_store=event_store, universe_service=universe_service)
auth_service = AuthService()
io_service = ImportExportService(task_executor=task_executor_service, universe_service=universe_service)
cosmos_service = CosmosService()
galaxy_dashboard_service = GalaxyDashboardService(projector=task_executor_service.read_model_projector)
constellation_dashboard_service = ConstellationDashboardService(universe_service=universe_service)
planet_dashboard_service = PlanetDashboardService(universe_service=universe_service)
moon_dashboard_service = MoonDashboardService(universe_service=universe_service)
bond_dashboard_service = BondDashboardService(universe_service=universe_service)
idempotency_service = IdempotencyService()
onboarding_service = OnboardingService()
schema_preset_service = SchemaPresetService(
    universe_service=universe_service,
    cosmos_service=cosmos_service,
    task_executor_service=task_executor_service,
)
preset_bundle_service = PresetBundleService(
    schema_preset_service=schema_preset_service,
    universe_service=universe_service,
    task_executor_service=task_executor_service,
)


def user_to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        is_active=user.is_active,
        deleted_at=user.deleted_at,
    )


def galaxy_to_public(galaxy: Galaxy) -> GalaxyPublic:
    return GalaxyPublic(
        id=galaxy.id,
        name=galaxy.name,
        owner_id=galaxy.owner_id,
        created_at=galaxy.created_at,
        deleted_at=galaxy.deleted_at,
    )


def galaxy_summary_to_public(summary) -> GalaxySummaryPublic:
    return GalaxySummaryPublic(
        user_id=summary.user_id,
        galaxy_id=summary.galaxy_id,
        constellations_count=summary.constellations_count,
        planets_count=summary.planets_count,
        moons_count=summary.moons_count,
        bonds_count=summary.bonds_count,
        formula_fields_count=summary.formula_fields_count,
        updated_at=summary.updated_at,
    )


def galaxy_health_to_public(health) -> GalaxyHealthPublic:
    return GalaxyHealthPublic(
        user_id=health.user_id,
        galaxy_id=health.galaxy_id,
        guardian_rules_count=health.guardian_rules_count,
        alerted_asteroids_count=health.alerted_asteroids_count,
        circular_fields_count=health.circular_fields_count,
        quality_score=health.quality_score,
        status=health.status,
        updated_at=health.updated_at,
    )


def galaxy_activity_to_public(item) -> GalaxyActivityPublic:
    return GalaxyActivityPublic(
        id=item.id,
        user_id=item.user_id,
        galaxy_id=item.galaxy_id,
        event_id=item.event_id,
        event_seq=item.event_seq,
        event_type=item.event_type,
        entity_id=item.entity_id,
        payload=item.payload if isinstance(item.payload, dict) else {},
        happened_at=item.happened_at,
        created_at=item.created_at,
    )


def constellation_summary_to_public(item: Mapping[str, Any]) -> ConstellationSummaryPublic:
    return ConstellationSummaryPublic(
        name=str(item.get("name") or "Uncategorized"),
        planets_count=int(item.get("planets_count") or 0),
        planet_names=[str(value) for value in (item.get("planet_names") or [])],
        moons_count=int(item.get("moons_count") or 0),
        formula_fields_count=int(item.get("formula_fields_count") or 0),
        internal_bonds_count=int(item.get("internal_bonds_count") or 0),
        external_bonds_count=int(item.get("external_bonds_count") or 0),
        guardian_rules_count=int(item.get("guardian_rules_count") or 0),
        alerted_moons_count=int(item.get("alerted_moons_count") or 0),
        circular_fields_count=int(item.get("circular_fields_count") or 0),
        quality_score=int(item.get("quality_score") or 0),
        status=str(item.get("status") or "GREEN"),
    )


def planet_summary_to_public(item: Mapping[str, Any]) -> PlanetSummaryPublic:
    return PlanetSummaryPublic(
        table_id=item["table_id"],
        name=str(item.get("name") or "Planet"),
        constellation_name=str(item.get("constellation_name") or "Uncategorized"),
        moons_count=int(item.get("moons_count") or 0),
        schema_fields_count=int(item.get("schema_fields_count") or 0),
        formula_fields_count=int(item.get("formula_fields_count") or 0),
        internal_bonds_count=int(item.get("internal_bonds_count") or 0),
        external_bonds_count=int(item.get("external_bonds_count") or 0),
        guardian_rules_count=int(item.get("guardian_rules_count") or 0),
        alerted_moons_count=int(item.get("alerted_moons_count") or 0),
        circular_fields_count=int(item.get("circular_fields_count") or 0),
        quality_score=int(item.get("quality_score") or 0),
        status=str(item.get("status") or "GREEN"),
        sector_mode=str(item.get("sector_mode") or "belt"),
    )


def moon_summary_to_public(item: Mapping[str, Any]) -> MoonSummaryPublic:
    return MoonSummaryPublic(
        asteroid_id=item["asteroid_id"],
        label=str(item.get("label") or ""),
        table_id=item["table_id"],
        table_name=str(item.get("table_name") or "Uncategorized"),
        constellation_name=str(item.get("constellation_name") or "Uncategorized"),
        planet_name=str(item.get("planet_name") or "Planet"),
        metadata_fields_count=int(item.get("metadata_fields_count") or 0),
        calculated_fields_count=int(item.get("calculated_fields_count") or 0),
        guardian_rules_count=int(item.get("guardian_rules_count") or 0),
        active_alerts_count=int(item.get("active_alerts_count") or 0),
        circular_fields_count=int(item.get("circular_fields_count") or 0),
        quality_score=int(item.get("quality_score") or 0),
        status=str(item.get("status") or "GREEN"),
        created_at=item.get("created_at"),
    )


def bond_summary_to_public(item: Mapping[str, Any]) -> BondSummaryPublic:
    semantics = bond_semantics(item.get("type", "RELATION"))
    return BondSummaryPublic(
        bond_id=item["bond_id"],
        type=semantics.bond_type,
        directional=bool(item.get("directional", semantics.directional)),
        flow_direction=str(item.get("flow_direction") or semantics.flow_direction),
        source_id=item["source_id"],
        target_id=item["target_id"],
        source_label=str(item.get("source_label") or ""),
        target_label=str(item.get("target_label") or ""),
        source_table_id=item["source_table_id"],
        target_table_id=item["target_table_id"],
        source_constellation_name=str(item.get("source_constellation_name") or "Uncategorized"),
        source_planet_name=str(item.get("source_planet_name") or "Planet"),
        target_constellation_name=str(item.get("target_constellation_name") or "Uncategorized"),
        target_planet_name=str(item.get("target_planet_name") or "Planet"),
        active_alerts_count=int(item.get("active_alerts_count") or 0),
        circular_fields_count=int(item.get("circular_fields_count") or 0),
        quality_score=int(item.get("quality_score") or 0),
        status=str(item.get("status") or "GREEN"),
        created_at=item.get("created_at"),
    )


def branch_to_public(branch: Branch) -> BranchPublic:
    return BranchPublic(
        id=branch.id,
        galaxy_id=branch.galaxy_id,
        name=branch.name,
        base_event_id=branch.base_event_id,
        created_by=branch.created_by,
        created_at=branch.created_at,
        deleted_at=branch.deleted_at,
    )


def table_contract_to_public(contract: TableContract) -> TableContractPublic:
    required_fields = contract.required_fields if isinstance(contract.required_fields, list) else []
    field_types = contract.field_types if isinstance(contract.field_types, dict) else {}
    unique_rules = contract.unique_rules if isinstance(contract.unique_rules, list) else []
    validators = contract.validators if isinstance(contract.validators, list) else []
    formula_registry = contract.formula_registry if isinstance(contract.formula_registry, list) else []
    physics_rulebook = contract.physics_rulebook if isinstance(contract.physics_rulebook, dict) else {}
    normalized_required_fields = [str(item) for item in required_fields]
    normalized_field_types = {str(key): str(value) for key, value in field_types.items()}
    normalized_unique_rules = [item for item in unique_rules if isinstance(item, dict)]
    normalized_validators = [item for item in validators if isinstance(item, dict)]
    normalized_formula_registry = [item for item in formula_registry if isinstance(item, dict)]
    raw_physics_rules = physics_rulebook.get("rules") if isinstance(physics_rulebook, dict) else []
    normalized_physics_rules = [item for item in raw_physics_rules if isinstance(item, dict)] if isinstance(raw_physics_rules, list) else []
    raw_physics_defaults = physics_rulebook.get("defaults") if isinstance(physics_rulebook, dict) else {}
    normalized_physics_defaults = raw_physics_defaults if isinstance(raw_physics_defaults, dict) else {}
    raw_auto_semantics = normalized_physics_defaults.get("auto_semantics") if isinstance(normalized_physics_defaults, dict) else []
    normalized_auto_semantics = [item for item in raw_auto_semantics if isinstance(item, dict)] if isinstance(raw_auto_semantics, list) else []
    return TableContractPublic(
        id=contract.id,
        galaxy_id=contract.galaxy_id,
        table_id=contract.table_id,
        version=contract.version,
        required_fields=normalized_required_fields,
        field_types=normalized_field_types,
        unique_rules=normalized_unique_rules,
        validators=normalized_validators,
        auto_semantics=normalized_auto_semantics,
        schema_registry={
            "required_fields": normalized_required_fields,
            "field_types": normalized_field_types,
            "unique_rules": normalized_unique_rules,
            "validators": normalized_validators,
            "auto_semantics": normalized_auto_semantics,
        },
        formula_registry=normalized_formula_registry,
        physics_rulebook={
            "rules": normalized_physics_rules,
            "defaults": normalized_physics_defaults,
        },
        created_by=contract.created_by,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        deleted_at=contract.deleted_at,
    )


def import_job_to_public(job: ImportJob) -> ImportJobPublic:
    return ImportJobPublic(
        id=job.id,
        user_id=job.user_id,
        galaxy_id=job.galaxy_id,
        filename=job.filename,
        file_hash=job.file_hash,
        mode=job.mode,
        status=job.status,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        errors_count=job.errors_count,
        summary=job.summary if isinstance(job.summary, dict) else {},
        created_at=job.created_at,
        finished_at=job.finished_at,
    )


def import_error_to_public(error: ImportError) -> ImportErrorPublic:
    return ImportErrorPublic(
        id=error.id,
        job_id=error.job_id,
        row_number=error.row_number,
        column_name=error.column_name,
        code=error.code,
        message=error.message,
        raw_value=error.raw_value,
        created_at=error.created_at,
    )


def transactional_context(session: AsyncSession):
    return session.begin_nested() if session.in_transaction() else session.begin()


async def commit_if_active(session: AsyncSession) -> None:
    if session.in_transaction():
        await session.commit()


def normalize_idempotency_key(raw: str | None) -> str | None:
    candidate = str(raw or "").strip()
    return candidate if candidate else None


async def resolve_scope_for_user(
    *,
    session: AsyncSession,
    user: User,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
) -> tuple[UUID, UUID | None]:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=user,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
    )
    return target_galaxy_id, target_branch_id


async def run_scoped_idempotent(
    *,
    session: AsyncSession,
    current_user: User,
    galaxy_id: UUID | None,
    branch_id: UUID | None,
    endpoint_key: str,
    idempotency_key: str | None,
    request_payload: dict[str, Any],
    execute: Callable[[UUID, UUID | None], Awaitable[Any]],
    replay_loader: Callable[[dict[str, Any]], Any],
    response_dumper: Callable[[Any], dict[str, Any]],
    empty_response_detail: str,
    empty_response_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    resolved_scope: tuple[UUID, UUID | None] | None = None,
) -> Any:
    normalized_idempotency_key = normalize_idempotency_key(idempotency_key)
    replayed_response: Any | None = None
    response_to_store: Any | None = None

    async with transactional_context(session):
        if resolved_scope is None:
            target_galaxy_id, target_branch_id = await resolve_scope_for_user(
                session=session,
                user=current_user,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
            )
        else:
            target_galaxy_id, target_branch_id = resolved_scope

        if normalized_idempotency_key is not None:
            request_hash = idempotency_service.request_hash(request_payload)
            replay = await idempotency_service.check_replay(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                endpoint=endpoint_key,
                idempotency_key=normalized_idempotency_key,
                request_hash=request_hash,
            )
            if replay is not None:
                replayed_response = replay_loader(replay.response_payload)
            else:
                response_to_store = await execute(target_galaxy_id, target_branch_id)
                await idempotency_service.store_response(
                    session=session,
                    user_id=current_user.id,
                    galaxy_id=target_galaxy_id,
                    branch_id=target_branch_id,
                    endpoint=endpoint_key,
                    idempotency_key=normalized_idempotency_key,
                    request_hash=request_hash,
                    status_code=status.HTTP_200_OK,
                    response_payload=response_dumper(response_to_store),
                )
        else:
            response_to_store = await execute(target_galaxy_id, target_branch_id)

    await commit_if_active(session)
    if replayed_response is not None:
        return replayed_response
    if response_to_store is None:
        raise HTTPException(status_code=empty_response_status, detail=empty_response_detail)
    return response_to_store


def sse_frame(*, event: str, data: Mapping[str, Any], event_id: int | None = None) -> str:
    lines = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"event: {event}")
    payload = json.dumps(dict(data), ensure_ascii=False, separators=(",", ":"))
    lines.append(f"data: {payload}")
    return "\n".join(lines) + "\n\n"


def asteroid_to_response(asteroid: ProjectedAsteroid | Mapping[str, Any]) -> AsteroidResponse:
    if isinstance(asteroid, Mapping):
        return AsteroidResponse(
            id=asteroid["id"],
            value=asteroid.get("value"),
            metadata=asteroid.get("metadata", {}),
            is_deleted=bool(asteroid.get("is_deleted", False)),
            created_at=asteroid["created_at"],
            deleted_at=asteroid.get("deleted_at"),
            current_event_seq=int(asteroid.get("current_event_seq", 0) or 0),
        )
    return AsteroidResponse(
        id=asteroid.id,
        value=asteroid.value,
        metadata=asteroid.metadata,
        is_deleted=asteroid.is_deleted,
        created_at=asteroid.created_at,
        deleted_at=asteroid.deleted_at,
        current_event_seq=int(getattr(asteroid, "current_event_seq", 0) or 0),
    )


def bond_to_response(bond: ProjectedBond | Mapping[str, Any]) -> BondResponse:
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        return BondResponse(
            id=bond["id"],
            source_id=bond["source_id"],
            target_id=bond["target_id"],
            type=semantics.bond_type,
            directional=semantics.directional,
            flow_direction=semantics.flow_direction,
            is_deleted=bool(bond.get("is_deleted", False)),
            created_at=bond["created_at"],
            deleted_at=bond.get("deleted_at"),
            current_event_seq=int(bond.get("current_event_seq", 0) or 0),
        )
    semantics = bond_semantics(bond.type)
    return BondResponse(
        id=bond.id,
        source_id=bond.source_id,
        target_id=bond.target_id,
        type=semantics.bond_type,
        directional=semantics.directional,
        flow_direction=semantics.flow_direction,
        is_deleted=bond.is_deleted,
        created_at=bond.created_at,
        deleted_at=bond.deleted_at,
        current_event_seq=int(getattr(bond, "current_event_seq", 0) or 0),
    )


def task_to_response(task: AtomicTask) -> TaskSchema:
    return TaskSchema(action=task.action, params=task.params)


def execution_to_response(tasks: list[AtomicTask], execution: TaskExecutionResult) -> ParseCommandResponse:
    return ParseCommandResponse(
        tasks=[task_to_response(task) for task in tasks],
        asteroids=[asteroid_to_response(asteroid) for asteroid in execution.asteroids],
        bonds=[bond_to_response(bond) for bond in execution.bonds],
        selected_asteroids=[asteroid_to_response(asteroid) for asteroid in execution.selected_asteroids],
        extinguished_asteroid_ids=execution.extinguished_asteroid_ids,
        extinguished_bond_ids=execution.extinguished_bond_ids,
        semantic_effects=execution.semantic_effects,
    )


def universe_asteroid_to_snapshot(
    asteroid: ProjectedAsteroid | Mapping[str, Any],
    *,
    galaxy_id: UUID = DEFAULT_GALAXY_ID,
) -> UniverseAsteroidSnapshot:
    if isinstance(asteroid, Mapping):
        metadata = asteroid.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        calculated_values = asteroid.get("calculated_values", {})
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        calc_errors = asteroid.get("calc_errors", [])
        if not isinstance(calc_errors, list):
            calc_errors = []
        physics = asteroid.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        active_alerts = asteroid.get("active_alerts", [])
        if not isinstance(active_alerts, list):
            active_alerts = []
        error_count = int(asteroid.get("error_count", len([item for item in calc_errors if isinstance(item, dict)])) or 0)
        circular_fields_count = int(asteroid.get("circular_fields_count", 0) or 0)
        table_name_raw = asteroid.get("table_name")
        table_name = (
            table_name_raw.strip()
            if isinstance(table_name_raw, str) and table_name_raw.strip()
            else derive_table_name(value=asteroid.get("value"), metadata=metadata)
        )
        constellation_name_raw = asteroid.get("constellation_name")
        planet_name_raw = asteroid.get("planet_name")
        if isinstance(constellation_name_raw, str) and constellation_name_raw.strip() and isinstance(planet_name_raw, str) and planet_name_raw.strip():
            constellation_name = constellation_name_raw.strip()
            planet_name = planet_name_raw.strip()
        else:
            constellation_name, planet_name = split_constellation_and_planet_name(table_name)
        table_id = asteroid.get("table_id")
        table_uuid = table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        return UniverseAsteroidSnapshot(
            id=asteroid["id"],
            value=asteroid.get("value"),
            table_id=table_uuid,
            table_name=table_name,
            constellation_name=constellation_name,
            planet_name=planet_name,
            metadata=metadata,
            calculated_values=calculated_values,
            calc_errors=[item for item in calc_errors if isinstance(item, dict)],
            error_count=error_count,
            circular_fields_count=circular_fields_count,
            active_alerts=[str(alert) for alert in active_alerts],
            physics=physics,
            facts=build_moon_facts(
                value=asteroid.get("value"),
                metadata=metadata,
                calculated_values=calculated_values,
                calc_errors=calc_errors,
            ),
            created_at=asteroid["created_at"],
            current_event_seq=int(asteroid.get("current_event_seq", 0) or 0),
        )

    table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
    constellation_name, planet_name = split_constellation_and_planet_name(table_name)
    return UniverseAsteroidSnapshot(
        id=asteroid.id,
        value=asteroid.value,
        table_id=derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
        table_name=table_name,
        constellation_name=constellation_name,
        planet_name=planet_name,
        metadata=asteroid.metadata,
        calculated_values={},
        calc_errors=[],
        error_count=0,
        circular_fields_count=0,
        active_alerts=[],
        physics={},
        facts=build_moon_facts(value=asteroid.value, metadata=asteroid.metadata, calculated_values={}, calc_errors=[]),
        created_at=asteroid.created_at,
        current_event_seq=int(getattr(asteroid, "current_event_seq", 0) or 0),
    )


def universe_bond_to_snapshot(
    bond: ProjectedBond | Mapping[str, Any],
    *,
    asteroid_table_index: Mapping[UUID, tuple[UUID, str, str, str]] | None = None,
) -> UniverseBondSnapshot:
    table_index = asteroid_table_index or {}
    if isinstance(bond, Mapping):
        semantics = bond_semantics(bond.get("type", "RELATION"))
        source_id = bond["source_id"]
        target_id = bond["target_id"]
        physics = bond.get("physics", {})
        if not isinstance(physics, dict):
            physics = {}
        source_table_id, source_table_name, source_constellation_name, source_planet_name = table_index.get(
            source_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
            target_id,
            (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
        )
        return UniverseBondSnapshot(
            id=bond["id"],
            source_id=source_id,
            target_id=target_id,
            type=semantics.bond_type,
            physics=physics,
            directional=semantics.directional,
            flow_direction=semantics.flow_direction,
            source_table_id=source_table_id,
            source_table_name=source_table_name,
            source_constellation_name=source_constellation_name,
            source_planet_name=source_planet_name,
            target_table_id=target_table_id,
            target_table_name=target_table_name,
            target_constellation_name=target_constellation_name,
            target_planet_name=target_planet_name,
            current_event_seq=int(bond.get("current_event_seq", 0) or 0),
        )
    semantics = bond_semantics(bond.type)
    source_table_id, source_table_name, source_constellation_name, source_planet_name = table_index.get(
        bond.source_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    target_table_id, target_table_name, target_constellation_name, target_planet_name = table_index.get(
        bond.target_id,
        (DEFAULT_GALAXY_ID, "Unknown", "Unknown", "Unknown"),
    )
    return UniverseBondSnapshot(
        id=bond.id,
        source_id=bond.source_id,
        target_id=bond.target_id,
        type=semantics.bond_type,
        physics={},
        directional=semantics.directional,
        flow_direction=semantics.flow_direction,
        source_table_id=source_table_id,
        source_table_name=source_table_name,
        source_constellation_name=source_constellation_name,
        source_planet_name=source_planet_name,
        target_table_id=target_table_id,
        target_table_name=target_table_name,
        target_constellation_name=target_constellation_name,
        target_planet_name=target_planet_name,
        current_event_seq=int(getattr(bond, "current_event_seq", 0) or 0),
    )


async def resolve_galaxy_id_for_user(
    session: AsyncSession,
    *,
    user: User,
    galaxy_id: UUID | None,
) -> UUID:
    galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=user.id,
        galaxy_id=galaxy_id,
    )
    return galaxy.id


async def resolve_branch_id_for_user(
    session: AsyncSession,
    *,
    user: User,
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> UUID | None:
    return await cosmos_service.resolve_branch_id(
        session=session,
        user_id=user.id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
    )


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    async with transactional_context(session):
        user, galaxy = await auth_service.register(
            session=session,
            email=payload.email,
            password=payload.password,
            galaxy_name=payload.galaxy_name,
        )
        await onboarding_service.ensure_progress(
            session=session,
            user_id=user.id,
            galaxy_id=galaxy.id,
        )
    await commit_if_active(session)
    token = auth_service.create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_to_public(user),
        default_galaxy=galaxy_to_public(galaxy),
    )


@app.post("/auth/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    user = await auth_service.authenticate(session=session, email=payload.email, password=payload.password)
    galaxy = await auth_service.resolve_user_galaxy(session=session, user_id=user.id, galaxy_id=None)
    token = auth_service.create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_to_public(user),
        default_galaxy=galaxy_to_public(galaxy),
    )


@app.get("/auth/me", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_me(
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user_to_public(current_user)


@app.patch("/auth/me/extinguish", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_extinguish_me(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    async with transactional_context(session):
        user = await auth_service.soft_delete_user(session=session, user=current_user)
    await commit_if_active(session)
    return user_to_public(user)


@app.get("/galaxies", response_model=list[GalaxyPublic], status_code=status.HTTP_200_OK)
async def list_galaxies(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[GalaxyPublic]:
    galaxies = await auth_service.list_galaxies(session=session, user_id=current_user.id)
    return [galaxy_to_public(galaxy) for galaxy in galaxies]


@app.post("/galaxies", response_model=GalaxyPublic, status_code=status.HTTP_201_CREATED)
async def create_galaxy(
    payload: GalaxyCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await auth_service.create_galaxy(session=session, user_id=current_user.id, name=payload.name)
        await onboarding_service.ensure_progress(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy.id,
        )
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@app.patch("/galaxies/{galaxy_id}/extinguish", response_model=GalaxyPublic, status_code=status.HTTP_200_OK)
async def extinguish_galaxy(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await auth_service.soft_delete_galaxy(session=session, user_id=current_user.id, galaxy_id=galaxy_id)
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@app.get("/galaxies/{galaxy_id}/summary", response_model=GalaxySummaryPublic, status_code=status.HTTP_200_OK)
async def galaxy_summary(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxySummaryPublic:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    summary = await galaxy_dashboard_service.get_summary(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
    )
    return galaxy_summary_to_public(summary)


@app.get("/galaxies/{galaxy_id}/health", response_model=GalaxyHealthPublic, status_code=status.HTTP_200_OK)
async def galaxy_health(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyHealthPublic:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    health = await galaxy_dashboard_service.get_health(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
    )
    return galaxy_health_to_public(health)


@app.get("/galaxies/{galaxy_id}/activity", response_model=GalaxyActivityResponse, status_code=status.HTTP_200_OK)
async def galaxy_activity(
    galaxy_id: UUID,
    limit: int = Query(default=40, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyActivityResponse:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    items = await galaxy_dashboard_service.list_activity(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        limit=limit,
    )
    return GalaxyActivityResponse(items=[galaxy_activity_to_public(item) for item in items])


@app.get("/galaxies/{galaxy_id}/onboarding", response_model=OnboardingPublic, status_code=status.HTTP_200_OK)
async def get_galaxy_onboarding(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OnboardingPublic:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    return await onboarding_service.get_public(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
    )


@app.patch("/galaxies/{galaxy_id}/onboarding", response_model=OnboardingPublic, status_code=status.HTTP_200_OK)
async def update_galaxy_onboarding(
    galaxy_id: UUID,
    payload: OnboardingUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OnboardingPublic:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    async with transactional_context(session):
        response = await onboarding_service.update_public(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy.id,
            payload=payload,
        )
    await commit_if_active(session)
    return response


@app.get("/galaxies/{galaxy_id}/events/stream", status_code=status.HTTP_200_OK)
async def galaxy_events_stream(
    galaxy_id: UUID,
    request: Request,
    branch_id: UUID | None = Query(default=None),
    last_event_seq: int | None = Query(default=None, ge=0),
    poll_ms: int = Query(default=1200, ge=300, le=10000),
    heartbeat_sec: int = Query(default=15, ge=5, le=60),
    batch_size: int = Query(default=64, ge=1, le=256),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    async with AsyncSessionLocal() as bootstrap_session:
        target_galaxy = await auth_service.resolve_user_galaxy(
            session=bootstrap_session,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
        )
        target_branch_id = await resolve_branch_id_for_user(
            session=bootstrap_session,
            user=current_user,
            galaxy_id=target_galaxy.id,
            branch_id=branch_id,
        )
        initial_cursor = (
            int(last_event_seq)
            if last_event_seq is not None
            else await event_store.latest_event_seq(
                session=bootstrap_session,
                user_id=current_user.id,
                galaxy_id=target_galaxy.id,
                branch_id=target_branch_id,
            )
        )

    poll_seconds = max(0.3, poll_ms / 1000.0)
    heartbeat_ticks = max(1, int(round(heartbeat_sec / poll_seconds)))

    async def event_generator():
        cursor = max(0, initial_cursor)
        idle_ticks = 0

        yield sse_frame(
            event="ready",
            event_id=cursor if cursor > 0 else None,
            data={
                "last_event_seq": cursor,
                "poll_ms": poll_ms,
                "heartbeat_sec": heartbeat_sec,
            },
        )

        try:
            while True:
                if request is not None and await request.is_disconnected():
                    break

                async with AsyncSessionLocal() as stream_session:
                    events = await event_store.list_events_after(
                        session=stream_session,
                        user_id=current_user.id,
                        galaxy_id=target_galaxy.id,
                        branch_id=target_branch_id,
                        after_event_seq=cursor,
                        limit=batch_size,
                    )

                if events:
                    cursor = int(events[-1].event_seq)
                    event_types = sorted({str(event.event_type or "") for event in events if event.event_type})
                    entity_ids = sorted({str(event.entity_id) for event in events if event.entity_id is not None})
                    serialized_events = [
                        {
                            "event_seq": int(event.event_seq),
                            "event_type": str(event.event_type or ""),
                            "entity_id": str(event.entity_id),
                            "payload": event.payload if isinstance(event.payload, dict) else {},
                            "timestamp": event.timestamp.isoformat(),
                        }
                        for event in events
                    ]
                    yield sse_frame(
                        event="update",
                        event_id=cursor,
                        data={
                            "last_event_seq": cursor,
                            "events_count": len(events),
                            "event_types": event_types,
                            "entity_ids": entity_ids[:24],
                            "events": serialized_events,
                        },
                    )
                    idle_ticks = 0
                    continue

                idle_ticks += 1
                if idle_ticks >= heartbeat_ticks:
                    yield sse_frame(
                        event="keepalive",
                        event_id=cursor if cursor > 0 else None,
                        data={"last_event_seq": cursor},
                    )
                    idle_ticks = 0

                await asyncio.sleep(poll_seconds)
        except asyncio.CancelledError:
            return

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@app.get("/galaxies/{galaxy_id}/constellations", response_model=ConstellationSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_constellations(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ConstellationSummaryResponse:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    rows = await constellation_dashboard_service.list_constellations(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return ConstellationSummaryResponse(items=[constellation_summary_to_public(item) for item in rows])


@app.get("/galaxies/{galaxy_id}/planets", response_model=PlanetSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_planets(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PlanetSummaryResponse:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    rows = await planet_dashboard_service.list_planets(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return PlanetSummaryResponse(items=[planet_summary_to_public(item) for item in rows])


@app.get("/galaxies/{galaxy_id}/moons", response_model=MoonSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_moons(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MoonSummaryResponse:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    rows = await moon_dashboard_service.list_moons(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return MoonSummaryResponse(items=[moon_summary_to_public(item) for item in rows])


@app.get("/galaxies/{galaxy_id}/bonds", response_model=BondSummaryResponse, status_code=status.HTTP_200_OK)
async def galaxy_bonds(
    galaxy_id: UUID,
    as_of: datetime | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BondSummaryResponse:
    target_galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy.id,
        branch_id=branch_id,
    )
    rows = await bond_dashboard_service.list_bonds(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy.id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    return BondSummaryResponse(items=[bond_summary_to_public(item) for item in rows])


@app.get("/branches", response_model=list[BranchPublic], status_code=status.HTTP_200_OK)
async def list_branches(
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[BranchPublic]:
    branches = await cosmos_service.list_branches(
        session=session,
        user_id=current_user.id,
        galaxy_id=galaxy_id,
    )
    return [branch_to_public(branch) for branch in branches]


@app.post("/branches", response_model=BranchPublic, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BranchPublic:
    async with transactional_context(session):
        branch = await cosmos_service.create_branch(
            session=session,
            user_id=current_user.id,
            galaxy_id=payload.galaxy_id,
            name=payload.name,
            as_of=payload.as_of,
        )
    await commit_if_active(session)
    return branch_to_public(branch)


@app.post("/branches/{branch_id}/promote", response_model=BranchPromoteResponse, status_code=status.HTTP_200_OK)
async def promote_branch(
    branch_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BranchPromoteResponse:
    async with transactional_context(session):
        branch, promoted_events_count = await cosmos_service.promote_branch(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    await commit_if_active(session)
    return BranchPromoteResponse(branch=branch_to_public(branch), promoted_events_count=promoted_events_count)


@app.patch("/branches/{branch_id}/extinguish", response_model=BranchPublic, status_code=status.HTTP_200_OK)
async def extinguish_branch(
    branch_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BranchPublic:
    async with transactional_context(session):
        branch = await cosmos_service.extinguish_branch(
            session=session,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    await commit_if_active(session)
    return branch_to_public(branch)


@app.get("/contracts/{table_id}", response_model=TableContractPublic, status_code=status.HTTP_200_OK)
async def get_table_contract(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TableContractPublic:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    contract = await cosmos_service.get_table_contract(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        table_id=table_id,
    )
    return table_contract_to_public(contract)


@app.post("/contracts/{table_id}", response_model=TableContractPublic, status_code=status.HTTP_201_CREATED)
async def upsert_table_contract(
    table_id: UUID,
    payload: TableContractUpsertRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TableContractPublic:
    async with transactional_context(session):
        contract = await cosmos_service.upsert_table_contract(
            session=session,
            user_id=current_user.id,
            galaxy_id=payload.galaxy_id,
            table_id=table_id,
            schema_registry=payload.schema_registry,
            required_fields=payload.required_fields,
            field_types=payload.field_types,
            unique_rules=payload.unique_rules,
            validators=payload.validators,
            auto_semantics=payload.auto_semantics,
            formula_registry=payload.formula_registry,
            physics_rulebook=payload.physics_rulebook,
        )
    await commit_if_active(session)
    return table_contract_to_public(contract)


@app.post("/presets/apply", response_model=PresetBundleApplyResponse, status_code=status.HTTP_200_OK)
async def apply_preset_bundle(
    payload: PresetBundleApplyRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PresetBundleApplyResponse:
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
    )
    resolved_galaxy_id, resolved_branch_id = resolved_scope

    async def build_plan_for_scope(target_galaxy_id: UUID, target_branch_id: UUID | None):
        return await preset_bundle_service.build_apply_plan(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            bundle_key=payload.bundle_key,
            manifest=payload.manifest,
            conflict_strategy=payload.conflict_strategy.value,
            seed_rows=bool(payload.seed_rows),
        )

    def render_response(
        *,
        plan: Any,
        contracts: dict[str, TableContract] | None = None,
        created_refs: dict[str, UUID] | None = None,
        execution: TaskExecutionResult | None = None,
        executed_task_count: int = 0,
    ) -> PresetBundleApplyResponse:
        contracts_map = contracts or {}
        refs = created_refs or {}
        planet_rows: list[PresetBundleApplyPlanetResultPublic] = []
        for planet_plan in plan.planets:
            schema_plan = planet_plan.schema_plan
            if schema_plan is None:
                diff_payload = SchemaPresetApplyDiffPublic()
                contract_preview = SchemaPresetContractPreviewPublic()
                seed_plan = SchemaPresetSeedPlanPublic(
                    requested_rows=0,
                    skipped_existing_rows=0,
                    rows_to_create=0,
                    skipped_values=[],
                )
            else:
                requested_rows = len(schema_plan.preset.default_rows) if payload.seed_rows else 0
                diff_payload = SchemaPresetApplyDiffPublic(**schema_plan.contract_diff)
                contract_preview = SchemaPresetContractPreviewPublic(**schema_plan.merged_contract)
                seed_plan = SchemaPresetSeedPlanPublic(
                    requested_rows=requested_rows,
                    skipped_existing_rows=len(schema_plan.skipped_seed_values),
                    rows_to_create=len(schema_plan.seed_rows_to_create),
                    skipped_values=schema_plan.skipped_seed_values,
                )
            contract = contracts_map.get(planet_plan.planet.key)
            planet_rows.append(
                PresetBundleApplyPlanetResultPublic(
                    planet_key=planet_plan.planet.key,
                    table_id=planet_plan.table_id,
                    table_name=planet_plan.planet.table_name,
                    schema_preset_key=planet_plan.planet.schema_preset_key,
                    diff=diff_payload,
                    contract_preview=contract_preview,
                    seed_plan=seed_plan,
                    contract=table_contract_to_public(contract) if contract is not None else None,
                )
            )

        graph_plan = PresetBundleGraphPlanPublic(
            moons_requested=len(plan.manifest.moons),
            moons_to_create=len([moon for moon in plan.moons if not moon.skip_existing]),
            bonds_requested=len(plan.manifest.bonds),
            formulas_requested=len(plan.manifest.formulas),
            guardians_requested=len(plan.manifest.guardians),
        )

        execution_summary: PresetBundleExecutionPublic | None = None
        if execution is not None:
            touched_moons = len({item.id for item in execution.asteroids})
            execution_summary = PresetBundleExecutionPublic(
                task_count=executed_task_count,
                touched_moons=touched_moons,
                touched_bonds=len(execution.bonds),
                semantic_effects_count=len(execution.semantic_effects),
            )

        return PresetBundleApplyResponse(
            mode=payload.mode,
            bundle=PresetBundleSummaryPublic(
                key=plan.bundle_key,
                version=plan.bundle_version,
                name=plan.bundle_name,
                description=plan.bundle_description,
                tags=[str(item) for item in plan.bundle_tags],
                planets_count=len(plan.manifest.planets),
                moons_count=len(plan.manifest.moons),
                bonds_count=len(plan.manifest.bonds),
                formulas_count=len(plan.manifest.formulas),
                guardians_count=len(plan.manifest.guardians),
            ),
            planets=planet_rows,
            graph_plan=graph_plan,
            created_refs=refs,
            execution=execution_summary,
            warnings=plan.warnings,
        )

    if payload.mode == PresetApplyMode.preview:
        preview_plan = await build_plan_for_scope(resolved_galaxy_id, resolved_branch_id)
        return render_response(plan=preview_plan)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PresetBundleApplyResponse:
        commit_plan = await build_plan_for_scope(target_galaxy_id, target_branch_id)
        commit_result = await preset_bundle_service.apply_plan_commit(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            plan=commit_plan,
        )
        return render_response(
            plan=commit_plan,
            contracts=commit_result.planet_contracts,
            created_refs=commit_result.created_refs,
            execution=commit_result.execution,
            executed_task_count=commit_result.executed_task_count,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/presets/apply",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "bundle_key": payload.bundle_key,
            "manifest": payload.manifest,
            "mode": payload.mode.value,
            "conflict_strategy": payload.conflict_strategy.value,
            "seed_rows": bool(payload.seed_rows),
        },
        execute=execute_scoped,
        replay_loader=PresetBundleApplyResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Preset bundle apply failed",
        resolved_scope=resolved_scope,
    )


@app.post("/asteroids/ingest", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def ingest_asteroid(
    payload: AsteroidIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AsteroidResponse:
    tasks = [AtomicTask(action="INGEST", params={"value": payload.value, "metadata": payload.metadata})]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.asteroids:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Asteroid ingest failed")
        return asteroid_to_response(execution.asteroids[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/asteroids/ingest",
        idempotency_key=payload.idempotency_key,
        request_payload={"value": payload.value, "metadata": payload.metadata},
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid ingest failed",
    )


@app.patch("/asteroids/{asteroid_id}/extinguish", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def extinguish_asteroid(
    asteroid_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AsteroidResponse:
    params: dict[str, Any] = {"asteroid_id": str(asteroid_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if asteroid_id not in execution.extinguished_asteroid_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asteroid not found")
        deleted_asteroid = next(
            (asteroid for asteroid in execution.extinguished_asteroids if asteroid.id == asteroid_id),
            None,
        )
        if deleted_asteroid is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Extinguish result is inconsistent",
            )
        return asteroid_to_response(deleted_asteroid)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"asteroid_id": str(asteroid_id), "expected_event_seq": expected_event_seq},
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@app.patch("/asteroids/{asteroid_id}/mutate", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def mutate_asteroid(
    asteroid_id: UUID,
    payload: AsteroidMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AsteroidResponse:
    params: dict[str, Any] = {"asteroid_id": str(asteroid_id)}
    if payload.value is not None:
        params["value"] = payload.value
    if payload.metadata:
        params["metadata"] = payload.metadata
    if payload.expected_event_seq is not None:
        params["expected_event_seq"] = payload.expected_event_seq

    tasks = [AtomicTask(action="UPDATE_ASTEROID", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> AsteroidResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.asteroids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asteroid not found")
        mutated = next((asteroid for asteroid in execution.asteroids if asteroid.id == asteroid_id), execution.asteroids[0])
        return asteroid_to_response(mutated)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/asteroids/{asteroid_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "asteroid_id": str(asteroid_id),
            "value": payload.value,
            "metadata": payload.metadata,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=AsteroidResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Asteroid not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@app.post("/bonds/link", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def link_bond(
    payload: BondCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="LINK",
            params={
                "source_id": str(payload.source_id),
                "target_id": str(payload.target_id),
                "type": payload.type,
                **(
                    {"expected_source_event_seq": payload.expected_source_event_seq}
                    if payload.expected_source_event_seq is not None
                    else {}
                ),
                **(
                    {"expected_target_event_seq": payload.expected_target_event_seq}
                    if payload.expected_target_event_seq is not None
                    else {}
                ),
            },
        )
    ]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Bond link failed")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/bonds/link",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "source_id": str(payload.source_id),
            "target_id": str(payload.target_id),
            "type": payload.type,
            "expected_source_event_seq": payload.expected_source_event_seq,
            "expected_target_event_seq": payload.expected_target_event_seq,
        },
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond link failed",
    )


@app.patch("/bonds/{bond_id}/mutate", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def mutate_bond(
    bond_id: UUID,
    payload: BondMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="UPDATE_BOND",
            params={
                "bond_id": str(bond_id),
                "type": payload.type,
                **(
                    {"expected_event_seq": payload.expected_event_seq}
                    if payload.expected_event_seq is not None
                    else {}
                ),
            },
        )
    ]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[-1])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "bond_id": str(bond_id),
            "type": payload.type,
            "expected_event_seq": payload.expected_event_seq,
        },
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@app.patch("/bonds/{bond_id}/extinguish", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def extinguish_bond(
    bond_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BondResponse:
    params: dict[str, Any] = {"bond_id": str(bond_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH_BOND", params=params)]

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> BondResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"bond_id": str(bond_id), "expected_event_seq": expected_event_seq},
        execute=execute_scoped,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@app.post("/parser/execute", response_model=ParseCommandResponse, status_code=status.HTTP_200_OK)
async def parse_and_execute(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParseCommandResponse:
    target_galaxy_id: UUID | None = None
    target_branch_id: UUID | None = None

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        nonlocal target_galaxy_id, target_branch_id
        if target_galaxy_id is None:
            target_galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
            )
            target_branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=target_galaxy_id,
                branch_id=payload.branch_id,
            )
        return target_galaxy_id, target_branch_id

    tasks: list[AtomicTask]
    parser_version_explicit = "parser_version" in payload.model_fields_set
    if payload.parser_version == "v2":
        v2_error_message: str | None = None
        scoped_galaxy_id, scoped_branch_id = await ensure_scope()
        active_asteroids, _ = await universe_service.project_state(
            session=session,
            user_id=current_user.id,
            galaxy_id=scoped_galaxy_id,
            branch_id=scoped_branch_id,
            apply_calculations=False,
        )
        planner = Parser2SemanticPlanner(
            parser=parser2_planner.parser,
            resolver=SnapshotSemanticResolver(active_asteroids),
        )
        plan_result = planner.plan_text(payload.command)
        if plan_result.errors:
            v2_error_message = plan_result.errors[0].message
        elif plan_result.envelope is None:
            v2_error_message = "Parser2 did not produce intent envelope"
        else:
            bridge_result = parser2_executor_bridge.to_atomic_tasks(plan_result.envelope)
            if bridge_result.errors:
                v2_error_message = bridge_result.errors[0].message
            else:
                tasks = bridge_result.tasks

        if v2_error_message is not None:
            # Keep backwards compatibility for legacy callers that do not send parser_version.
            # Explicit parser_version=v2 remains strict and does not fall back.
            # Fallback can be globally disabled via DATAVERSE_PARSER_V2_FALLBACK_TO_V1.
            if parser_version_explicit or not parser_v2_fallback_to_v1_enabled():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {v2_error_message}",
                )

            parse_result = parser_service.parse_with_diagnostics(payload.command)
            if parse_result.errors:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Parse error: {v2_error_message}",
                )
            tasks = parse_result.tasks
    else:
        parse_result = parser_service.parse_with_diagnostics(payload.command)
        if parse_result.errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Parse error: {parse_result.errors[0]}",
            )
        tasks = parse_result.tasks

    resolved_scope: tuple[UUID, UUID | None] | None = None
    if target_galaxy_id is not None:
        resolved_scope = (target_galaxy_id, target_branch_id)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> ParseCommandResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        return execution_to_response(tasks=tasks, execution=execution)

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/parser/execute",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "command": payload.command,
            "parser_version": payload.parser_version,
        },
        execute=execute_scoped,
        replay_loader=ParseCommandResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Parser execution failed",
        resolved_scope=resolved_scope,
    )


@app.post("/tasks/execute-batch", response_model=TaskBatchExecuteResponse, status_code=status.HTTP_200_OK)
async def execute_task_batch(
    payload: TaskBatchExecuteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskBatchExecuteResponse:
    tasks = [AtomicTask(action=task.action, params=dict(task.params or {})) for task in payload.tasks]
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
    )
    resolved_galaxy_id, resolved_branch_id = resolved_scope

    if payload.mode == "preview":
        async with transactional_context(session):
            async with session.begin_nested() as preview_tx:
                execution = await task_executor_service.execute_tasks(
                    session=session,
                    tasks=tasks,
                    user_id=current_user.id,
                    galaxy_id=resolved_galaxy_id,
                    branch_id=resolved_branch_id,
                    manage_transaction=False,
                )
                result = execution_to_response(tasks=tasks, execution=execution)
                await preview_tx.rollback()
        return TaskBatchExecuteResponse(mode="preview", task_count=len(tasks), result=result)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> TaskBatchExecuteResponse:
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            manage_transaction=False,
        )
        return TaskBatchExecuteResponse(
            mode="commit",
            task_count=len(tasks),
            result=execution_to_response(tasks=tasks, execution=execution),
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/tasks/execute-batch",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "mode": payload.mode,
            "tasks": [task_to_response(task).model_dump(mode="json") for task in tasks],
        },
        execute=execute_scoped,
        replay_loader=TaskBatchExecuteResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Batch execution failed",
        resolved_scope=resolved_scope,
    )


@app.get("/universe/snapshot", response_model=UniverseSnapshotResponse, status_code=status.HTTP_200_OK)
async def universe_snapshot(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UniverseSnapshotResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
    )
    active_asteroids, active_bonds = await universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )

    asteroid_snapshots = [
        universe_asteroid_to_snapshot(asteroid, galaxy_id=target_galaxy_id)
        for asteroid in active_asteroids
    ]
    table_index: dict[UUID, tuple[UUID, str, str, str]] = {
        asteroid.id: (
            asteroid.table_id,
            asteroid.table_name,
            asteroid.constellation_name,
            asteroid.planet_name,
        )
        for asteroid in asteroid_snapshots
    }

    return UniverseSnapshotResponse(
        asteroids=asteroid_snapshots,
        bonds=[
            universe_bond_to_snapshot(
                bond,
                asteroid_table_index=table_index,
            )
            for bond in active_bonds
        ],
    )


@app.get("/universe/tables", response_model=UniverseTablesResponse, status_code=status.HTTP_200_OK)
async def universe_tables(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UniverseTablesResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
    )
    tables = await universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    normalized_tables: list[dict[str, Any]] = []
    for table in tables:
        item = dict(table)
        constellation_name = item.get("constellation_name")
        planet_name = item.get("planet_name")
        if not (isinstance(constellation_name, str) and constellation_name.strip() and isinstance(planet_name, str) and planet_name.strip()):
            resolved_constellation, resolved_planet = split_constellation_and_planet_name(item.get("name"))
            item["constellation_name"] = resolved_constellation
            item["planet_name"] = resolved_planet
        normalized_tables.append(item)
    return UniverseTablesResponse(tables=normalized_tables)


@app.post("/io/imports", response_model=ImportRunResponse, status_code=status.HTTP_200_OK)
async def run_import_csv(
    file: UploadFile = File(...),
    mode: ImportModeSchema = Form(default=ImportModeSchema.commit),
    strict: bool = Form(default=True),
    galaxy_id: UUID | None = Form(default=None),
    branch_id: UUID | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportRunResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Missing filename")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Phase 1 import supports CSV only",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Uploaded file is empty")

    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=galaxy_id,
        )
        target_branch_id = await resolve_branch_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=branch_id,
        )
        result = await io_service.import_csv(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            filename=file.filename,
            file_bytes=payload,
            mode=ImportMode(mode.value),
            strict=bool(strict),
        )
    await commit_if_active(session)
    return ImportRunResponse(job=import_job_to_public(result.job))


@app.get("/io/imports/{job_id}", response_model=ImportJobPublic, status_code=status.HTTP_200_OK)
async def get_import_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportJobPublic:
    job = await io_service.get_job_for_user(session=session, user_id=current_user.id, job_id=job_id)
    return import_job_to_public(job)


@app.get("/io/imports/{job_id}/errors", response_model=ImportErrorsResponse, status_code=status.HTTP_200_OK)
async def get_import_job_errors(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportErrorsResponse:
    errors = await io_service.get_job_errors(session=session, user_id=current_user.id, job_id=job_id)
    return ImportErrorsResponse(errors=[import_error_to_public(error) for error in errors])


@app.get("/io/exports/snapshot", status_code=status.HTTP_200_OK)
async def export_snapshot_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Phase 1 export supports CSV only")
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
    )
    csv_payload = await io_service.export_snapshot_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="snapshot-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)


@app.get("/io/exports/tables", status_code=status.HTTP_200_OK)
async def export_tables_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Phase 1 export supports CSV only")
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
    )
    csv_payload = await io_service.export_tables_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="tables-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)
