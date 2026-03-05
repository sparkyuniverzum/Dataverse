from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.models import Branch, Galaxy, ImportError, ImportJob, TableContract, User
from app.schemas import (
    BondSummaryPublic,
    BranchPublic,
    ConstellationSummaryPublic,
    GalaxyActivityPublic,
    GalaxyHealthPublic,
    GalaxyPublic,
    GalaxySummaryPublic,
    ImportErrorPublic,
    ImportJobPublic,
    MoonSummaryPublic,
    PlanetSummaryPublic,
    StarCoreDomainMetricPublic,
    StarCoreDomainMetricsResponse,
    StarCorePhysicsProfileMigrateResponse,
    StarCorePhysicsProfilePublic,
    StarCorePlanetPhysicsItemPublic,
    StarCorePlanetPhysicsMetricsPublic,
    StarCorePlanetPhysicsResponse,
    StarCorePlanetPhysicsVisualPublic,
    StarCorePolicyPublic,
    StarCorePulseEventPublic,
    StarCorePulseResponse,
    StarCoreRuntimePublic,
    TableContractPublic,
    UserPublic,
)
from app.services.bond_semantics import bond_semantics


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


def star_core_policy_to_public(item: Mapping[str, Any]) -> StarCorePolicyPublic:
    lock_status = str(item.get("lock_status") or "draft").lower()
    return StarCorePolicyPublic(
        profile_key=str(item.get("profile_key") or "ORIGIN").upper(),
        law_preset=str(item.get("law_preset") or "balanced"),
        profile_mode=str(item.get("profile_mode") or ("locked" if lock_status == "locked" else "auto")),
        no_hard_delete=bool(item.get("no_hard_delete", True)),
        deletion_mode=str(item.get("deletion_mode") or "soft_delete"),
        occ_enforced=bool(item.get("occ_enforced", True)),
        idempotency_supported=bool(item.get("idempotency_supported", True)),
        branch_scope_supported=bool(item.get("branch_scope_supported", True)),
        lock_status=lock_status,
        policy_version=max(1, int(item.get("policy_version") or 1)),
        locked_at=item.get("locked_at"),
        can_edit_core_laws=bool(item.get("can_edit_core_laws", lock_status != "locked")),
    )


def star_core_runtime_to_public(item: Mapping[str, Any]) -> StarCoreRuntimePublic:
    return StarCoreRuntimePublic(
        as_of_event_seq=int(item.get("as_of_event_seq") or 0),
        events_count=int(item.get("events_count") or 0),
        writes_per_minute=float(item.get("writes_per_minute") or 0.0),
    )


def star_core_pulse_to_public(item: Mapping[str, Any]) -> StarCorePulseResponse:
    events = [
        StarCorePulseEventPublic(
            event_seq=int(event.get("event_seq") or 0),
            event_type=str(event.get("event_type") or ""),
            entity_id=event["entity_id"],
            visual_hint=str(event.get("visual_hint") or "orbital_pulse"),
            intensity=float(event.get("intensity") or 0.0),
        )
        for event in (item.get("events") or [])
        if isinstance(event, dict) and event.get("entity_id") is not None
    ]
    return StarCorePulseResponse(
        galaxy_id=item["galaxy_id"],
        branch_id=item.get("branch_id"),
        last_event_seq=int(item.get("last_event_seq") or 0),
        sampled_count=int(item.get("sampled_count") or len(events)),
        event_types=[str(value) for value in (item.get("event_types") or [])],
        events=events,
    )


def star_core_domain_metrics_to_public(item: Mapping[str, Any]) -> StarCoreDomainMetricsResponse:
    domains = [
        StarCoreDomainMetricPublic(
            domain_name=str(domain.get("domain_name") or "Uncategorized"),
            status=str(domain.get("status") or "GREEN"),
            events_count=int(domain.get("events_count") or 0),
            activity_intensity=float(domain.get("activity_intensity") or 0.0),
        )
        for domain in (item.get("domains") or [])
        if isinstance(domain, Mapping)
    ]
    return StarCoreDomainMetricsResponse(
        galaxy_id=item["galaxy_id"],
        branch_id=item.get("branch_id"),
        sampled_window_size=int(item.get("sampled_window_size") or 0),
        sampled_since=item.get("sampled_since"),
        sampled_until=item.get("sampled_until"),
        total_events_count=int(item.get("total_events_count") or 0),
        domains=domains,
        updated_at=item["updated_at"],
    )


def star_core_physics_profile_to_public(item: Mapping[str, Any]) -> StarCorePhysicsProfilePublic:
    coefficients_raw = item.get("coefficients")
    coefficients = (
        {str(key): float(value) for key, value in coefficients_raw.items() if str(key).strip()}
        if isinstance(coefficients_raw, Mapping)
        else {}
    )
    return StarCorePhysicsProfilePublic(
        galaxy_id=item["galaxy_id"],
        profile_key=str(item.get("profile_key") or "BALANCE").upper(),
        profile_version=max(1, int(item.get("profile_version") or 1)),
        lock_status=str(item.get("lock_status") or "draft").lower(),
        locked_at=item.get("locked_at"),
        coefficients=coefficients,
    )


def star_core_physics_migration_to_public(item: Mapping[str, Any]) -> StarCorePhysicsProfileMigrateResponse:
    return StarCorePhysicsProfileMigrateResponse(
        galaxy_id=item["galaxy_id"],
        profile_key=str(item.get("profile_key") or "BALANCE").upper(),
        from_version=max(1, int(item.get("from_version") or 1)),
        to_version=max(1, int(item.get("to_version") or 1)),
        reason=str(item.get("reason") or "").strip() or "migration",
        dry_run=bool(item.get("dry_run", True)),
        applied=bool(item.get("applied", False)),
        lock_status=str(item.get("lock_status") or "locked").lower(),
        impacted_planets=max(0, int(item.get("impacted_planets") or 0)),
        estimated_runtime_items=max(0, int(item.get("estimated_runtime_items") or 0)),
    )


def star_core_planet_physics_to_public(item: Mapping[str, Any]) -> StarCorePlanetPhysicsResponse:
    rows: list[StarCorePlanetPhysicsItemPublic] = []
    for raw in item.get("items") or []:
        if not isinstance(raw, Mapping):
            continue
        metrics_raw = raw.get("metrics") if isinstance(raw.get("metrics"), Mapping) else {}
        visual_raw = raw.get("visual") if isinstance(raw.get("visual"), Mapping) else {}
        table_id = raw.get("table_id")
        if table_id is None:
            continue
        rows.append(
            StarCorePlanetPhysicsItemPublic(
                table_id=table_id,
                phase=str(raw.get("phase") or "CALM"),
                metrics=StarCorePlanetPhysicsMetricsPublic(
                    activity=float(metrics_raw.get("activity") or 0.0),
                    stress=float(metrics_raw.get("stress") or 0.0),
                    health=float(metrics_raw.get("health") or 1.0),
                    inactivity=float(metrics_raw.get("inactivity") or 0.0),
                    corrosion=float(metrics_raw.get("corrosion") or 0.0),
                    rows=max(0, int(metrics_raw.get("rows") or 0)),
                ),
                visual=StarCorePlanetPhysicsVisualPublic(
                    size_factor=float(visual_raw.get("size_factor") or 1.0),
                    luminosity=float(visual_raw.get("luminosity") or 0.0),
                    pulse_rate=float(visual_raw.get("pulse_rate") or 0.0),
                    hue=float(visual_raw.get("hue") or 0.0),
                    saturation=float(visual_raw.get("saturation") or 0.0),
                    corrosion_level=float(visual_raw.get("corrosion_level") or 0.0),
                    crack_intensity=float(visual_raw.get("crack_intensity") or 0.0),
                ),
                source_event_seq=max(0, int(raw.get("source_event_seq") or 0)),
                engine_version=str(raw.get("engine_version") or "star-physics-v2-preview"),
            )
        )
    return StarCorePlanetPhysicsResponse(
        as_of_event_seq=max(0, int(item.get("as_of_event_seq") or 0)),
        items=rows,
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
        archetype=str(item.get("archetype") or "").strip() or None,
        contract_version=int(item.get("contract_version")) if item.get("contract_version") is not None else None,
        is_empty=bool(item.get("is_empty", False)),
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
    normalized_physics_rules = (
        [item for item in raw_physics_rules if isinstance(item, dict)] if isinstance(raw_physics_rules, list) else []
    )
    raw_physics_defaults = physics_rulebook.get("defaults") if isinstance(physics_rulebook, dict) else {}
    normalized_physics_defaults = raw_physics_defaults if isinstance(raw_physics_defaults, dict) else {}
    raw_auto_semantics = (
        normalized_physics_defaults.get("auto_semantics") if isinstance(normalized_physics_defaults, dict) else []
    )
    normalized_auto_semantics = (
        [item for item in raw_auto_semantics if isinstance(item, dict)] if isinstance(raw_auto_semantics, list) else []
    )
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
