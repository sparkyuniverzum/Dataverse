from __future__ import annotations

from datetime import UTC, datetime
from math import floor
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import universe_asteroid_to_snapshot
from app.api.mappers.public import table_contract_to_public
from app.api.runtime import get_service_container, resolve_scope_for_user, run_scoped_idempotent
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.planets.commands import (
    PlanetPolicyError,
    ensure_main_timeline,
    ensure_planet_empty_for_extinguish,
    plan_create_planet,
    plan_extinguish_planet,
)
from app.domains.planets.queries import (
    PlanetQueryConflictError,
    PlanetQueryForbiddenError,
    PlanetQueryNotFoundError,
    get_planet_table,
    list_latest_planet_contracts,
    list_planet_tables,
)
from app.domains.shared.commands import (
    SharedCommandError,
    append_event as append_shared_event,
)
from app.models import Event, TableContract, User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    MoonImpactItem,
    MoonImpactResponse,
    MoonImpactSummary,
    MoonImpactViolationSample,
    MoonImpactViolationSampleDetail,
    PlanetArchetype,
    PlanetCreateRequest,
    PlanetCreateResponse,
    PlanetExtinguishResponse,
    PlanetListResponse,
    PlanetPublic,
    UniverseTableSnapshot,
    civilization_snapshot_to_moon_row,
)
from app.services.task_executor.contract_validation import TableContractValidator
from app.services.universe_service import split_constellation_and_planet_name

router = APIRouter(tags=["planets"])


def _policy_to_http_exception(exc: PlanetPolicyError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def _query_to_http_exception(
    exc: PlanetQueryNotFoundError | PlanetQueryConflictError | PlanetQueryForbiddenError,
) -> HTTPException:
    if isinstance(exc, PlanetQueryNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PlanetQueryForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def _shared_command_to_http_exception(exc: SharedCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _coerce_archetype(raw: object) -> PlanetArchetype | None:
    value = str(raw or "").strip().lower()
    if not value:
        return None
    try:
        return PlanetArchetype(value)
    except ValueError:
        return None


def _planet_from_table(*, table_payload: dict, contract: TableContract | None) -> PlanetPublic:
    table_name = str(table_payload.get("name") or "Uncategorized")
    constellation_name, planet_name = split_constellation_and_planet_name(table_name)
    members = table_payload.get("members") if isinstance(table_payload.get("members"), list) else []
    internal_bonds = (
        table_payload.get("internal_bonds") if isinstance(table_payload.get("internal_bonds"), list) else []
    )
    external_bonds = (
        table_payload.get("external_bonds") if isinstance(table_payload.get("external_bonds"), list) else []
    )
    archetype = _coerce_archetype(table_payload.get("archetype"))
    contract_version_raw = table_payload.get("contract_version")
    contract_version = int(contract_version_raw) if isinstance(contract_version_raw, int) else None
    if contract is not None and contract_version is None:
        contract_version = int(contract.version)
    return PlanetPublic(
        table_id=table_payload["table_id"],
        table_name=table_name,
        constellation_name=constellation_name,
        planet_name=planet_name,
        archetype=archetype,
        contract_version=contract_version,
        moons_count=len(members),
        schema_fields=[str(item) for item in (table_payload.get("schema_fields") or [])],
        formula_fields=[str(item) for item in (table_payload.get("formula_fields") or [])],
        internal_bonds_count=len(internal_bonds),
        external_bonds_count=len(external_bonds),
        sector=table_payload.get("sector")
        or {"center": [0.0, 0.0, 0.0], "size": 260.0, "mode": "belt", "grid_plate": True},
        is_empty=len(members) == 0,
        contract=table_contract_to_public(contract) if contract is not None else None,
    )


def _moon_impact_error(*, status_code: int, message: str, entity_id: str | None = None) -> HTTPException:
    detail: dict[str, Any] = {
        "code": "MOON_IMPACT_ERROR",
        "message": str(message or "Moon impact request failed"),
        "context": "moon_impact",
    }
    if entity_id:
        detail["entity_id"] = str(entity_id)
    return HTTPException(status_code=status_code, detail=detail)


def _coerce_uuid(raw: object) -> UUID | None:
    if isinstance(raw, UUID):
        return raw
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _normalize_capability_class(raw: object) -> str:
    return str(raw or "").strip().lower() or "validation"


def _normalize_rule_id(default_prefix: str, raw: object, mineral_key: str) -> str:
    value = str(raw or "").strip()
    if value:
        return value
    suffix = str(mineral_key or "value").strip() or "value"
    return f"{default_prefix}:{suffix}"


def _build_rule_specs(capability) -> list[dict[str, Any]]:
    config = capability.config_json if isinstance(capability.config_json, dict) else {}
    specs: list[dict[str, Any]] = []
    capability_id = _coerce_uuid(getattr(capability, "id", None))
    capability_key = str(getattr(capability, "capability_key", "") or "").strip()
    capability_class = _normalize_capability_class(getattr(capability, "capability_class", None))

    for field in [str(item).strip() for item in (config.get("required_fields") or [])]:
        if not field:
            continue
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("required", None, field),
                "rule_kind": "required",
                "mineral_key": field,
                "impact_kind": "enforce",
                "expected_constraint": {"required": True},
                "repair_hint": f"Provide required value for '{field}'.",
            }
        )

    field_types = config.get("field_types") if isinstance(config.get("field_types"), dict) else {}
    for raw_field, raw_type in field_types.items():
        field = str(raw_field or "").strip()
        expected_type = str(raw_type or "").strip().lower()
        if not field or not expected_type:
            continue
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("type", None, field),
                "rule_kind": "type",
                "mineral_key": field,
                "impact_kind": "validate",
                "expected_constraint": {"type": expected_type},
                "repair_hint": f"Use value compatible with type '{expected_type}' for '{field}'.",
                "expected_type": expected_type,
            }
        )

    validators = config.get("validators") if isinstance(config.get("validators"), list) else []
    for item in validators:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field") or "").strip()
        operator = str(item.get("operator") or "").strip()
        if not field or not operator:
            continue
        expected_value = item["value"] if "value" in item else item.get("threshold")
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("validator", item.get("id"), field),
                "rule_kind": "validator",
                "mineral_key": field,
                "impact_kind": "validate",
                "expected_constraint": {"operator": operator, "value": expected_value},
                "repair_hint": (
                    f"Adjust '{field}' to satisfy '{operator} {expected_value}'."
                    if expected_value is not None
                    else f"Adjust '{field}' to satisfy operator '{operator}'."
                ),
                "operator": operator,
                "expected_value": expected_value,
            }
        )

    unique_rules = config.get("unique_rules") if isinstance(config.get("unique_rules"), list) else []
    for item in unique_rules:
        if not isinstance(item, dict):
            continue
        raw_fields = item.get("fields")
        if isinstance(raw_fields, str):
            fields = [raw_fields]
        elif isinstance(raw_fields, list):
            fields = [str(part).strip() for part in raw_fields if str(part).strip()]
        else:
            fields = []
        if not fields:
            continue
        mineral_key = ",".join(fields)
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("unique", item.get("id"), mineral_key),
                "rule_kind": "unique",
                "mineral_key": mineral_key,
                "impact_kind": "enforce",
                "expected_constraint": {"unique": fields},
                "repair_hint": f"Use a unique value for '{mineral_key}'.",
                "unique_fields": fields,
            }
        )

    formula_registry = config.get("formula_registry") if isinstance(config.get("formula_registry"), list) else []
    for item in formula_registry:
        if not isinstance(item, dict):
            continue
        target_field = str(item.get("target") or item.get("field") or "").strip()
        if not target_field:
            continue
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("formula", item.get("id"), target_field),
                "rule_kind": "formula",
                "mineral_key": target_field,
                "impact_kind": "derive",
                "expected_constraint": None,
                "repair_hint": f"Review formula output for '{target_field}' and repair dependent minerals.",
            }
        )

    if capability_class == "bridge":
        specs.append(
            {
                "capability_id": capability_id,
                "capability_key": capability_key,
                "capability_class": capability_class,
                "rule_id": _normalize_rule_id("bridge", None, capability_key or "bridge"),
                "rule_kind": "bridge",
                "mineral_key": "*",
                "impact_kind": "link",
                "expected_constraint": None,
                "repair_hint": None,
            }
        )

    return specs


def _moon_violation_state(moon_row) -> str:
    raw_state = str(getattr(moon_row, "state", "") or "").strip().upper()
    if raw_state == "ANOMALY":
        return "ANOMALY"
    return "WARNING"


def _fact_map(moon_row) -> dict[str, Any]:
    facts = getattr(moon_row, "facts", [])
    if not isinstance(facts, list):
        return {}
    by_key: dict[str, Any] = {}
    for fact in facts:
        key = str(getattr(fact, "key", "") or "").strip()
        if key and key not in by_key:
            by_key[key] = fact
    return by_key


def _required_violation(facts_by_key: dict[str, Any], mineral_key: str) -> bool:
    fact = facts_by_key.get(mineral_key)
    if fact is None:
        return True
    value = getattr(fact, "typed_value", None)
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def _type_violation(facts_by_key: dict[str, Any], mineral_key: str, expected_type: str) -> bool:
    fact = facts_by_key.get(mineral_key)
    if fact is None:
        return False
    try:
        return not TableContractValidator._matches_expected_type(expected_type, getattr(fact, "typed_value", None))
    except HTTPException:
        return True


def _validator_violation(
    facts_by_key: dict[str, Any], mineral_key: str, operator: str | None, expected_value: Any | None
) -> bool:
    if not operator:
        return False
    fact = facts_by_key.get(mineral_key)
    if fact is None:
        return False
    try:
        return not TableContractValidator._passes_validator(
            operator=operator,
            field_value=getattr(fact, "typed_value", None),
            expected_value=expected_value,
        )
    except HTTPException:
        return True


def _formula_violation(facts_by_key: dict[str, Any], mineral_key: str) -> bool:
    fact = facts_by_key.get(mineral_key)
    if fact is None:
        return False
    errors = getattr(fact, "errors", [])
    status_value = str(getattr(fact, "status", "") or "").strip().lower()
    return bool(errors) or status_value == "invalid"


async def _append_planet_event(
    *,
    services: ServiceContainer,
    session: AsyncSession,
    current_user: User,
    galaxy_id: UUID,
    branch_id: UUID | None,
    table_id: UUID,
    event_type: str,
    payload: dict,
) -> Event:
    try:
        event = await append_shared_event(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            entity_id=table_id,
            event_type=event_type,
            payload=payload,
        )
    except SharedCommandError as exc:
        raise _shared_command_to_http_exception(exc) from exc
    if branch_id is None:
        await services.cosmos_service.read_model_projector.apply_events(session=session, events=[event])
    return event


@router.get("/planets", response_model=PlanetListResponse, status_code=status.HTTP_200_OK)
async def list_planets(
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetListResponse:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        tables = await list_planet_tables(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            branch_id=resolved_branch_id,
        )
    except (PlanetQueryNotFoundError, PlanetQueryConflictError, PlanetQueryForbiddenError) as exc:
        raise _query_to_http_exception(exc) from exc
    table_ids = [item["table_id"] for item in tables if isinstance(item.get("table_id"), UUID)]
    try:
        contracts_by_table = await list_latest_planet_contracts(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            table_ids=table_ids,
        )
    except (PlanetQueryNotFoundError, PlanetQueryConflictError, PlanetQueryForbiddenError) as exc:
        raise _query_to_http_exception(exc) from exc
    items = [
        _planet_from_table(table_payload=table, contract=contracts_by_table.get(table["table_id"]))
        for table in tables
        if isinstance(table.get("table_id"), UUID)
    ]
    items.sort(key=lambda item: (item.constellation_name.lower(), item.planet_name.lower(), str(item.table_id)))
    return PlanetListResponse(items=items)


@router.get("/planets/{table_id}", response_model=PlanetPublic, status_code=status.HTTP_200_OK)
async def get_planet(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetPublic:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        table_payload = await get_planet_table(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            branch_id=resolved_branch_id,
            table_id=table_id,
        )
        contracts_by_table = await list_latest_planet_contracts(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            table_ids=[table_id],
        )
    except (PlanetQueryNotFoundError, PlanetQueryConflictError, PlanetQueryForbiddenError) as exc:
        raise _query_to_http_exception(exc) from exc
    return _planet_from_table(table_payload=table_payload, contract=contracts_by_table.get(table_id))


@router.get("/planets/{planet_id}/moon-impact", response_model=MoonImpactResponse, status_code=status.HTTP_200_OK)
async def get_planet_moon_impact(
    planet_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    capability_id: UUID | None = Query(default=None),
    capability_key: str | None = Query(default=None),
    include_civilization_ids: bool = Query(default=True),
    include_violation_samples: bool = Query(default=True),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> MoonImpactResponse:
    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )

    try:
        tables = await list_planet_tables(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            branch_id=resolved_branch_id,
        )
    except (PlanetQueryNotFoundError, PlanetQueryConflictError, PlanetQueryForbiddenError) as exc:
        raise _query_to_http_exception(exc) from exc
    table_exists = any(item.get("table_id") == planet_id for item in tables if isinstance(item, dict))
    if not table_exists:
        raise _moon_impact_error(
            status_code=status.HTTP_404_NOT_FOUND,
            message="Planet not found in resolved scope.",
            entity_id=str(planet_id),
        )

    capabilities = await services.cosmos_service.list_moon_capabilities(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        table_id=planet_id,
        include_inactive=False,
        include_history=False,
    )

    filtered_capabilities = list(capabilities)
    if capability_id is not None:
        filtered_capabilities = [item for item in filtered_capabilities if getattr(item, "id", None) == capability_id]
        if not filtered_capabilities:
            raise _moon_impact_error(
                status_code=status.HTTP_404_NOT_FOUND,
                message="Capability not found for selected planet.",
                entity_id=str(capability_id),
            )
    elif capability_key:
        normalized_key = str(capability_key).strip().lower()
        filtered_capabilities = [
            item
            for item in filtered_capabilities
            if str(getattr(item, "capability_key", "")).strip().lower() == normalized_key
        ]
        if not filtered_capabilities:
            raise _moon_impact_error(
                status_code=status.HTTP_404_NOT_FOUND,
                message="Capability key not found for selected planet.",
                entity_id=str(capability_key),
            )

    civilizations, _ = await services.universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=resolved_galaxy_id,
        branch_id=resolved_branch_id,
        as_of=None,
    )
    moon_rows: list[Any] = []
    for civilization in civilizations:
        snapshot_row = universe_asteroid_to_snapshot(civilization, galaxy_id=resolved_galaxy_id)
        if snapshot_row.table_id != planet_id:
            continue
        moon_rows.append(civilization_snapshot_to_moon_row(snapshot_row))

    unique_signatures: dict[tuple[str, tuple[Any, ...]], dict[tuple[Any, ...], list[UUID]]] = {}
    for moon_row in moon_rows:
        facts_by_key = _fact_map(moon_row)
        moon_id = _coerce_uuid(getattr(moon_row, "moon_id", None))
        if moon_id is None:
            continue
        for capability in filtered_capabilities:
            for rule in _build_rule_specs(capability):
                if rule.get("rule_kind") != "unique":
                    continue
                fields = rule.get("unique_fields") or []
                if not isinstance(fields, list) or not fields:
                    continue
                signature = tuple(getattr(facts_by_key.get(field), "typed_value", None) for field in fields)
                key = (str(rule["rule_id"]), tuple(str(field) for field in fields))
                unique_signatures.setdefault(key, {}).setdefault(signature, []).append(moon_id)

    items: list[MoonImpactItem] = []
    summary_impacted_civilization_ids: set[UUID] = set()
    summary_impacted_mineral_keys: set[str] = set()
    summary_active_violations = 0
    max_samples = max(1, min(1000, floor(limit)))
    max_items = max_samples
    for capability in filtered_capabilities:
        for rule in _build_rule_specs(capability):
            if len(items) >= max_items:
                break
            capability_uuid = _coerce_uuid(rule.get("capability_id"))
            if capability_uuid is None:
                continue

            samples: list[MoonImpactViolationSample] = []
            for moon_row in moon_rows:
                moon_id = _coerce_uuid(getattr(moon_row, "moon_id", None))
                if moon_id is None:
                    continue
                facts_by_key = _fact_map(moon_row)
                rule_kind = str(rule.get("rule_kind") or "").strip().lower()
                mineral_key = str(rule.get("mineral_key") or "").strip() or "value"
                is_violated = False

                if rule_kind == "required":
                    is_violated = _required_violation(facts_by_key, mineral_key=mineral_key)
                elif rule_kind == "type":
                    is_violated = _type_violation(
                        facts_by_key,
                        mineral_key=mineral_key,
                        expected_type=str(rule.get("expected_type") or ""),
                    )
                elif rule_kind == "validator":
                    is_violated = _validator_violation(
                        facts_by_key,
                        mineral_key=mineral_key,
                        operator=rule.get("operator"),
                        expected_value=rule.get("expected_value"),
                    )
                elif rule_kind == "formula":
                    is_violated = _formula_violation(facts_by_key, mineral_key=mineral_key)
                elif rule_kind == "unique":
                    fields = rule.get("unique_fields") or []
                    if isinstance(fields, list) and fields:
                        signature = tuple(getattr(facts_by_key.get(field), "typed_value", None) for field in fields)
                        key = (str(rule["rule_id"]), tuple(str(field) for field in fields))
                        duplicates = unique_signatures.get(key, {}).get(signature, [])
                        is_violated = len(duplicates) > 1
                elif rule_kind == "bridge":
                    is_violated = False

                if not is_violated:
                    continue

                samples.append(
                    MoonImpactViolationSample(
                        civilization_id=moon_id,
                        mineral_key=mineral_key,
                        state=_moon_violation_state(moon_row),
                        detail=MoonImpactViolationSampleDetail(
                            rule_id=str(rule.get("rule_id") or ""),
                            capability_id=capability_uuid,
                            expected_constraint=rule.get("expected_constraint"),
                            repair_hint=rule.get("repair_hint"),
                        ),
                    )
                )
                if len(samples) >= max_samples:
                    break

            impacted_ids = sorted({sample.civilization_id for sample in samples}, key=str)
            impacted_minerals = sorted({sample.mineral_key for sample in samples})
            summary_impacted_civilization_ids.update(impacted_ids)
            summary_impacted_mineral_keys.update(impacted_minerals)
            summary_active_violations += len(samples)
            items.append(
                MoonImpactItem(
                    capability_id=capability_uuid,
                    capability_key=str(rule.get("capability_key") or ""),
                    capability_class=str(rule.get("capability_class") or "validation"),
                    rule_id=str(rule.get("rule_id") or ""),
                    rule_kind=str(rule.get("rule_kind") or "validator"),
                    mineral_key=str(rule.get("mineral_key") or "value"),
                    impact_kind=str(rule.get("impact_kind") or "validate"),
                    impacted_civilizations_count=len(impacted_ids),
                    impacted_minerals_count=len(impacted_minerals),
                    active_violations_count=len(samples),
                    impacted_civilization_ids=impacted_ids if include_civilization_ids else [],
                    violation_samples=samples if include_violation_samples else [],
                )
            )
        if len(items) >= max_items:
            break

    unique_capability_ids = {item.capability_id for item in items}

    return MoonImpactResponse(
        planet_id=planet_id,
        galaxy_id=resolved_galaxy_id,
        branch_id=resolved_branch_id,
        generated_at=datetime.now(UTC),
        items=items,
        summary=MoonImpactSummary(
            capabilities_count=len(unique_capability_ids),
            rules_count=len(items),
            impacted_civilizations_count=len(summary_impacted_civilization_ids),
            impacted_minerals_count=len(summary_impacted_mineral_keys),
            active_violations_count=summary_active_violations,
        ),
    )


@router.post("/planets", response_model=PlanetCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_planet(
    payload: PlanetCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetCreateResponse:
    create_plan = plan_create_planet(
        name=payload.name,
        archetype=payload.archetype.value,
        initial_schema_mode=payload.initial_schema_mode.value,
        schema_preset_key=payload.schema_preset_key,
        seed_rows=payload.seed_rows,
        visual_position=payload.visual_position.model_dump() if payload.visual_position is not None else None,
    )
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PlanetCreateResponse:
        try:
            ensure_main_timeline(branch_id=target_branch_id)
        except PlanetPolicyError as exc:
            raise _policy_to_http_exception(exc) from exc

        contract, table_id, table_name = await services.cosmos_service.create_planet_contract(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            table_name=payload.name,
            archetype=payload.archetype.value,
            visual_position=payload.visual_position.model_dump() if payload.visual_position is not None else None,
        )

        if payload.initial_schema_mode.value == "preset":
            preset_key = str(payload.schema_preset_key or "").strip()
            plan = await services.schema_preset_service.build_apply_plan(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                table_id=table_id,
                preset_key=preset_key,
                conflict_strategy="skip",
                target_table_name=table_name,
                seed_rows=bool(payload.seed_rows),
            )
            contract, _ = await services.schema_preset_service.apply_plan_commit(
                session=session,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                plan=plan,
            )

        await _append_planet_event(
            services=services,
            session=session,
            current_user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            table_id=table_id,
            event_type="PLANET_CREATED",
            payload={
                "table_id": str(table_id),
                "table_name": table_name,
                "archetype": payload.archetype.value,
                "initial_schema_mode": payload.initial_schema_mode.value,
            },
        )

        tables = await services.universe_service.tables_snapshot(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            as_of=None,
        )
        table_payload = next((item for item in tables if item.get("table_id") == table_id), None)
        if table_payload is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Planet created but cannot be resolved in universe tables snapshot.",
            )

        constellation_name, planet_name = split_constellation_and_planet_name(
            str(table_payload.get("name") or table_name)
        )
        table_public = UniverseTableSnapshot.model_validate(table_payload)
        return PlanetCreateResponse(
            table_id=table_id,
            table_name=str(table_payload.get("name") or table_name),
            constellation_name=constellation_name,
            planet_name=planet_name,
            archetype=payload.archetype,
            contract=table_contract_to_public(contract),
            table=table_public,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/planets",
        idempotency_key=payload.idempotency_key,
        request_payload=create_plan.request_payload,
        execute=execute_scoped,
        replay_loader=PlanetCreateResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Planet creation failed",
        resolved_scope=resolved_scope,
    )


@router.patch("/planets/{table_id}/extinguish", response_model=PlanetExtinguishResponse, status_code=status.HTTP_200_OK)
async def extinguish_planet(
    table_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PlanetExtinguishResponse:
    extinguish_plan = plan_extinguish_planet(table_id=table_id)
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        services=services,
    )

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PlanetExtinguishResponse:
        try:
            ensure_main_timeline(branch_id=target_branch_id)
        except PlanetPolicyError as exc:
            raise _policy_to_http_exception(exc) from exc

        try:
            tables = await list_planet_tables(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
            )
        except (PlanetQueryNotFoundError, PlanetQueryConflictError, PlanetQueryForbiddenError) as exc:
            raise _query_to_http_exception(exc) from exc
        table_payload = next((item for item in tables if item.get("table_id") == table_id), None)
        table_name = str(table_id)
        if table_payload is not None:
            table_name = str(table_payload.get("name") or table_name)
            try:
                ensure_planet_empty_for_extinguish(table_payload=table_payload)
            except PlanetPolicyError as exc:
                raise _policy_to_http_exception(exc) from exc

        deleted_versions = await services.cosmos_service.soft_delete_planet_contracts(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            table_id=table_id,
        )

        await _append_planet_event(
            services=services,
            session=session,
            current_user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            table_id=table_id,
            event_type="PLANET_EXTINGUISHED",
            payload={
                "table_id": str(table_id),
                "table_name": table_name,
                "deleted_contract_versions": deleted_versions,
            },
        )
        return PlanetExtinguishResponse(
            table_id=table_id,
            extinguished=True,
            deleted_contract_versions=deleted_versions,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/planets/{table_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload=extinguish_plan.request_payload,
        execute=execute_scoped,
        replay_loader=PlanetExtinguishResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Planet extinguish failed",
        resolved_scope=resolved_scope,
    )
