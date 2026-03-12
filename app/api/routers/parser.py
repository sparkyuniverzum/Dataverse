from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import execution_to_response
from app.api.runtime import (
    get_service_container,
    resolve_branch_id_for_user,
    resolve_galaxy_id_for_user,
    run_scoped_atomic_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.infrastructure.runtime.parser.aliases import (
    deactivate_parser_alias,
    list_parser_aliases_for_galaxy,
    patch_parser_alias,
    select_visible_aliases,
    upsert_parser_alias,
)
from app.infrastructure.runtime.parser.command_service import (
    ParseTaskResolution,
    ScopedContext,
    resolve_plan_for_payload,
    resolve_tasks_for_payload,
)
from app.infrastructure.runtime.parser.lexicon_cz import build_parser_lexicon_payload
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    ParseCommandLexiconResponse,
    ParseCommandPlanResponse,
    ParseCommandPreviewExpectedEvent,
    ParseCommandPreviewOccSignal,
    ParseCommandPreviewResponse,
    ParseCommandPreviewRiskFlags,
    ParseCommandPreviewScope,
    ParseCommandPreviewSemanticEffectExpected,
    ParseCommandRequest,
    ParseCommandResponse,
    ParserAliasesResponse,
    ParserAliasMutationResponse,
    ParserAliasPatchRequest,
    ParserAliasRecord,
    ParserAliasUpsertRequest,
)
from app.services.task_executor.target_resolution import TargetResolver
from app.services.universe_service import ProjectedCivilization

router = APIRouter(tags=["parser"])

_MUTATING_ACTIONS = {
    "INGEST",
    "UPDATE_CIVILIZATION",
    "LINK",
    "DELETE",
    "EXTINGUISH",
    "SET_FORMULA",
    "ADD_GUARDIAN",
}
_DESTRUCTIVE_ACTIONS = {"DELETE", "EXTINGUISH", "EXTINGUISH_BOND", "EXTINGUISH_PLANET", "EXTINGUISH_GALAXY"}
_EXPECTED_EVENT_TYPES_BY_ACTION: dict[str, list[str]] = {
    "INGEST": ["CIVILIZATION_CREATED", "METADATA_UPDATED"],
    "UPDATE_CIVILIZATION": ["CIVILIZATION_VALUE_UPDATED", "METADATA_UPDATED"],
    "LINK": ["BOND_CREATED", "BOND_SOFT_DELETED"],
    "DELETE": ["CIVILIZATION_SOFT_DELETED", "BOND_SOFT_DELETED"],
    "EXTINGUISH": ["CIVILIZATION_SOFT_DELETED", "BOND_SOFT_DELETED"],
    "SET_FORMULA": ["METADATA_UPDATED"],
    "ADD_GUARDIAN": ["METADATA_UPDATED"],
    "SELECT": [],
}
_SEMANTIC_CODE_BY_ACTION: dict[str, str] = {
    "INGEST": "PREVIEW_CIVILIZATION_UPSERT",
    "UPDATE_CIVILIZATION": "PREVIEW_CIVILIZATION_UPDATE",
    "LINK": "PREVIEW_BOND_MUTATION",
    "DELETE": "PREVIEW_CIVILIZATION_EXTINGUISH",
    "EXTINGUISH": "PREVIEW_CIVILIZATION_EXTINGUISH",
    "SET_FORMULA": "PREVIEW_FORMULA_UPDATE",
    "ADD_GUARDIAN": "PREVIEW_GUARDIAN_UPDATE",
    "SELECT": "PREVIEW_SELECT",
}


def _normalize_plan_tasks(raw_tasks: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for task in list(raw_tasks or []):
        if isinstance(task, dict):
            normalized.append(task)
            continue
        action = getattr(task, "action", None)
        params = getattr(task, "params", None)
        source_text = getattr(task, "source_text", "")
        if action is not None:
            normalized.append(
                {
                    "action": str(action),
                    "params": params if isinstance(params, dict) else {},
                    "source_text": str(source_text or ""),
                }
            )
    return normalized


def _build_expected_event_preview(tasks: list[dict[str, Any]]) -> list[ParseCommandPreviewExpectedEvent]:
    items: list[ParseCommandPreviewExpectedEvent] = []
    for task in tasks:
        action = str(task.get("action") or "").strip().upper()
        if not action:
            continue
        event_types = list(_EXPECTED_EVENT_TYPES_BY_ACTION.get(action, []))
        because = (
            "Akce mutuje runtime stav a zapisuje domenove eventy."
            if event_types
            else "Akce je read-only nebo bez priameho event zapisu."
        )
        items.append(ParseCommandPreviewExpectedEvent(action=action, event_types=event_types, because=because))
    return items


def _build_risk_flags(tasks: list[dict[str, Any]], *, branch_id: UUID | None) -> ParseCommandPreviewRiskFlags:
    actions = {str(task.get("action") or "").strip().upper() for task in tasks}
    actions.discard("")
    mutating = any(action in _MUTATING_ACTIONS for action in actions)
    destructive = any(action in _DESTRUCTIVE_ACTIONS for action in actions)
    multi_step = len(tasks) > 1
    scope_sensitive = mutating or branch_id is not None
    requires_confirmation = destructive or (mutating and multi_step)
    return ParseCommandPreviewRiskFlags(
        mutating=mutating,
        destructive=destructive,
        multi_step=multi_step,
        scope_sensitive=scope_sensitive,
        requires_confirmation=requires_confirmation,
    )


def _next_step_hint(*, resolution: ParseTaskResolution, risk_flags: ParseCommandPreviewRiskFlags) -> str:
    if risk_flags.destructive:
        return "Pred commitem potvrď destruktivni dopad a zkontroluj scope."
    if resolution.fallback_used:
        return "Parser pouzil fallback na v1; pred execute over syntax a scope."
    if risk_flags.requires_confirmation:
        return "Plan obsahuje vic kroku; pred execute over poradi akci."
    return "Plan vypada bezpecne, muzes pokracovat na /parser/execute."


def _parse_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _resolve_preview_selector(
    *, selector: str, civilizations: list[ProjectedCivilization]
) -> tuple[ProjectedCivilization | None, str]:
    normalized = str(selector or "").strip()
    if not normalized:
        return None, "Selector je prazdny."

    parsed_uuid = TargetResolver.parse_uuid(normalized)
    if parsed_uuid is not None:
        for civilization in civilizations:
            if civilization.id == parsed_uuid:
                return civilization, ""
        return None, "Civilization ID nebyla nalezena v aktivnim scope."

    lowered = normalized.lower()
    exact_matches = [
        civilization
        for civilization in civilizations
        if TargetResolver.value_to_text(civilization.value).strip().lower() == lowered
    ]
    if len(exact_matches) == 1:
        return exact_matches[0], ""
    if len(exact_matches) > 1:
        return None, "Selector je nejednoznacny (vice presnych shod)."

    partial_matches = [
        civilization
        for civilization in civilizations
        if lowered in TargetResolver.value_to_text(civilization.value).lower()
    ]
    if len(partial_matches) == 1:
        return partial_matches[0], ""
    if len(partial_matches) > 1:
        return None, "Selector je nejednoznacny (vice castecnych shod)."
    return None, "Cilova civilizace nebyla nalezena."


def _append_civilization_occ_signal(
    *,
    items: list[ParseCommandPreviewOccSignal],
    action: str,
    selector: str | None,
    civilization: ProjectedCivilization | None,
    expected_event_seq: int | None,
    unknown_reason: str,
) -> None:
    if civilization is not None:
        current_event_seq = int(getattr(civilization, "current_event_seq", 0) or 0)
        items.append(
            ParseCommandPreviewOccSignal(
                action=action,
                entity_kind="civilization",
                entity_id=civilization.id,
                selector=selector,
                expected_event_seq=expected_event_seq if expected_event_seq is not None else current_event_seq,
                current_event_seq=current_event_seq,
                known=True,
                because="Mutacni akce vyzaduje OCC seq pro cilovou civilizaci.",
            )
        )
        return

    items.append(
        ParseCommandPreviewOccSignal(
            action=action,
            entity_kind="civilization",
            selector=selector,
            expected_event_seq=expected_event_seq,
            current_event_seq=None,
            known=False,
            because=unknown_reason,
        )
    )


def _build_occ_signals(
    tasks: list[dict[str, Any]], *, civilizations: list[ProjectedCivilization]
) -> list[ParseCommandPreviewOccSignal]:
    items: list[ParseCommandPreviewOccSignal] = []
    civilizations_by_id = {civilization.id: civilization for civilization in civilizations}

    for task in tasks:
        action = str(task.get("action") or "").strip().upper()
        params = task.get("params")
        params_map = params if isinstance(params, dict) else {}

        if action == "UPDATE_CIVILIZATION":
            civilization_uuid = TargetResolver.parse_uuid(params_map.get("civilization_id"))
            expected_event_seq = _parse_optional_int(params_map.get("expected_event_seq"))
            civilization = civilizations_by_id.get(civilization_uuid) if civilization_uuid is not None else None
            _append_civilization_occ_signal(
                items=items,
                action=action,
                selector=str(civilization_uuid) if civilization_uuid is not None else None,
                civilization=civilization,
                expected_event_seq=expected_event_seq,
                unknown_reason="Cilova civilization_id neni validni nebo neni v aktivnim scope.",
            )
            continue

        if action in {"DELETE", "EXTINGUISH", "SET_FORMULA", "ADD_GUARDIAN"}:
            expected_event_seq = _parse_optional_int(params_map.get("expected_event_seq"))
            selector = str(
                params_map.get("civilization_id")
                or params_map.get("target")
                or params_map.get("target_civilization")
                or ""
            ).strip()
            civilization_uuid = TargetResolver.parse_uuid(params_map.get("civilization_id"))
            civilization = civilizations_by_id.get(civilization_uuid) if civilization_uuid is not None else None
            reason = "Cilova civilizace neni urcena."
            if civilization is None and selector:
                civilization, reason = _resolve_preview_selector(selector=selector, civilizations=civilizations)
            _append_civilization_occ_signal(
                items=items,
                action=action,
                selector=selector or None,
                civilization=civilization,
                expected_event_seq=expected_event_seq,
                unknown_reason=reason,
            )
            continue

        if action == "LINK":
            source_uuid = TargetResolver.parse_uuid(params_map.get("source_civilization_id"))
            target_uuid = TargetResolver.parse_uuid(params_map.get("target_civilization_id"))
            expected_source_event_seq = _parse_optional_int(params_map.get("expected_source_event_seq"))
            expected_target_event_seq = _parse_optional_int(params_map.get("expected_target_event_seq"))

            if source_uuid is None or target_uuid is None:
                items.append(
                    ParseCommandPreviewOccSignal(
                        action=action,
                        entity_kind="civilization",
                        selector=None,
                        expected_event_seq=None,
                        current_event_seq=None,
                        known=False,
                        because="LINK bez explicitnich IDs navazuje na runtime context (INGEST chain).",
                    )
                )
                continue

            source_civilization = civilizations_by_id.get(source_uuid)
            target_civilization = civilizations_by_id.get(target_uuid)
            _append_civilization_occ_signal(
                items=items,
                action=action,
                selector=str(source_uuid),
                civilization=source_civilization,
                expected_event_seq=expected_source_event_seq,
                unknown_reason="Source civilization_id neni v aktivnim scope.",
            )
            _append_civilization_occ_signal(
                items=items,
                action=action,
                selector=str(target_uuid),
                civilization=target_civilization,
                expected_event_seq=expected_target_event_seq,
                unknown_reason="Target civilization_id neni v aktivnim scope.",
            )
            continue

    return items


def _build_semantic_effects_expected(
    *,
    tasks: list[dict[str, Any]],
    occ_signals: list[ParseCommandPreviewOccSignal],
    branch_id: UUID | None,
) -> list[ParseCommandPreviewSemanticEffectExpected]:
    items: list[ParseCommandPreviewSemanticEffectExpected] = []
    for index, task in enumerate(tasks):
        action = str(task.get("action") or "").strip().upper()
        if action not in _MUTATING_ACTIONS:
            continue

        destructive = action in _DESTRUCTIVE_ACTIONS
        scope_sensitive = True
        because_chain = [
            f"Akce `{action}` mutuje runtime stav a zapisuje eventy do timeline.",
            "Mutace probehne az v `/parser/execute`; `/parser/preview` je read-only plan.",
        ]
        if destructive:
            because_chain.append(
                "Akce je destruktivni (soft-delete lifecycle) a vyzaduje explicitni operator potvrzeni."
            )

        related_occ = [signal for signal in occ_signals if signal.action.upper() == action]
        if related_occ:
            if any(signal.known for signal in related_occ):
                because_chain.append(
                    "OCC target je znamy; `current_event_seq` byl odhadnut z aktualniho snapshotu scope."
                )
            if any(not signal.known for signal in related_occ):
                because_chain.append("Cast OCC targetu neni jednoznacna; execute muze vratit OCC/target conflict.")
        else:
            because_chain.append("OCC signal nelze predem odhadnout pro tento typ mutace.")

        if branch_id is None:
            because_chain.append("Scope je `main` timeline.")
        else:
            because_chain.append(f"Scope je branch `{branch_id}`.")

        items.append(
            ParseCommandPreviewSemanticEffectExpected(
                task_index=index,
                action=action,
                code=_SEMANTIC_CODE_BY_ACTION.get(action, "PREVIEW_MUTATION"),
                event_types=list(_EXPECTED_EVENT_TYPES_BY_ACTION.get(action, [])),
                mutating=True,
                destructive=destructive,
                scope_sensitive=scope_sensitive,
                because_chain=because_chain,
            )
        )
    return items


@router.get("/parser/lexicon", response_model=ParseCommandLexiconResponse, status_code=status.HTTP_200_OK)
async def parser_lexicon(
    _current_user: User = Depends(get_current_user),
) -> ParseCommandLexiconResponse:
    payload = build_parser_lexicon_payload()
    return ParseCommandLexiconResponse.model_validate(payload)


@router.get("/parser/aliases", response_model=ParserAliasesResponse, status_code=status.HTTP_200_OK)
async def parser_aliases_list(
    galaxy_id: UUID | None = None,
    include_inactive: bool = True,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParserAliasesResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    aliases = await list_parser_aliases_for_galaxy(session=session, galaxy_id=target_galaxy_id)
    visible = select_visible_aliases(aliases, current_user_id=current_user.id, include_inactive=include_inactive)
    return ParserAliasesResponse(aliases=[ParserAliasRecord.model_validate(item.__dict__) for item in visible])


@router.put("/parser/aliases", response_model=ParserAliasMutationResponse, status_code=status.HTTP_200_OK)
async def parser_aliases_upsert(
    payload: ParserAliasUpsertRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParserAliasMutationResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        services=services,
    )
    alias, event_type = await upsert_parser_alias(
        session=session,
        actor_user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        scope_type=payload.scope_type,
        alias_phrase=payload.alias_phrase,
        canonical_command=payload.canonical_command,
        event_writer=services.event_store.append_event,
    )
    await session.commit()
    return ParserAliasMutationResponse(alias=ParserAliasRecord.model_validate(alias.__dict__), event_type=event_type)


@router.patch("/parser/aliases/{alias_id}", response_model=ParserAliasMutationResponse, status_code=status.HTTP_200_OK)
async def parser_aliases_patch(
    alias_id: UUID,
    payload: ParserAliasPatchRequest,
    galaxy_id: UUID | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParserAliasMutationResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    alias, event_type = await patch_parser_alias(
        session=session,
        actor_user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        alias_id=alias_id,
        alias_phrase=payload.alias_phrase,
        canonical_command=payload.canonical_command,
        is_active=payload.is_active,
        event_writer=services.event_store.append_event,
    )
    await session.commit()
    return ParserAliasMutationResponse(alias=ParserAliasRecord.model_validate(alias.__dict__), event_type=event_type)


@router.delete("/parser/aliases/{alias_id}", response_model=ParserAliasMutationResponse, status_code=status.HTTP_200_OK)
async def parser_aliases_delete(
    alias_id: UUID,
    galaxy_id: UUID | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParserAliasMutationResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    alias, event_type = await deactivate_parser_alias(
        session=session,
        actor_user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        alias_id=alias_id,
        event_writer=services.event_store.append_event,
    )
    await session.commit()
    return ParserAliasMutationResponse(alias=ParserAliasRecord.model_validate(alias.__dict__), event_type=event_type)


@router.post("/parser/preview", response_model=ParseCommandPreviewResponse, status_code=status.HTTP_200_OK)
async def parse_preview(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandPreviewResponse:
    scoped_context = ScopedContext()

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        if scoped_context.galaxy_id is None:
            scoped_context.galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            scoped_context.branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=scoped_context.galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return scoped_context.galaxy_id, scoped_context.branch_id

    resolution = await resolve_plan_for_payload(
        payload=payload,
        session=session,
        current_user_id=current_user.id,
        services=services,
        ensure_scope=ensure_scope,
    )
    normalized_tasks = _normalize_plan_tasks(resolution.tasks)
    active_civilizations, _ = await services.universe_service.project_state(
        session=session,
        user_id=current_user.id,
        galaxy_id=scoped_context.galaxy_id,
        branch_id=scoped_context.branch_id,
        apply_calculations=False,
    )
    occ_signals = _build_occ_signals(normalized_tasks, civilizations=active_civilizations)
    risk_flags = _build_risk_flags(normalized_tasks, branch_id=scoped_context.branch_id)
    expected_events = _build_expected_event_preview(normalized_tasks)
    semantic_effects_expected = _build_semantic_effects_expected(
        tasks=normalized_tasks,
        occ_signals=occ_signals,
        branch_id=scoped_context.branch_id,
    )
    return ParseCommandPreviewResponse(
        resolved_command=resolution.resolved_command,
        parser_version_requested=resolution.parser_version_requested,
        parser_version_effective=resolution.parser_version_effective,
        parser_path=resolution.parser_path,
        alias_used=resolution.alias_used,
        alias_id=resolution.alias_id,
        alias_phrase=resolution.alias_phrase,
        alias_scope_type=resolution.alias_scope_type,
        alias_version=resolution.alias_version,
        fallback_used=resolution.fallback_used,
        fallback_policy_mode=resolution.fallback_policy_mode,
        fallback_policy_reason=resolution.fallback_policy_reason,
        fallback_detail=resolution.fallback_detail,
        intents=list(resolution.intent_kinds),
        tasks=normalized_tasks,
        expected_events=expected_events,
        occ_signals=occ_signals,
        semantic_effects_expected=semantic_effects_expected,
        risk_flags=risk_flags,
        scope=ParseCommandPreviewScope(galaxy_id=scoped_context.galaxy_id, branch_id=scoped_context.branch_id),
        next_step_hint=_next_step_hint(resolution=resolution, risk_flags=risk_flags),
    )


@router.post("/parser/plan", response_model=ParseCommandPlanResponse, status_code=status.HTTP_200_OK)
async def parse_only(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandPlanResponse:
    scoped_context = ScopedContext()

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        if scoped_context.galaxy_id is None:
            scoped_context.galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            scoped_context.branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=scoped_context.galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return scoped_context.galaxy_id, scoped_context.branch_id

    tasks = await resolve_tasks_for_payload(
        payload=payload,
        session=session,
        current_user_id=current_user.id,
        services=services,
        ensure_scope=ensure_scope,
    )
    return ParseCommandPlanResponse(tasks=_normalize_plan_tasks(tasks), parser_version=payload.parser_version)


@router.post("/parser/execute", response_model=ParseCommandResponse, status_code=status.HTTP_200_OK)
async def parse_and_execute(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ParseCommandResponse:
    scoped_context = ScopedContext()

    async def ensure_scope() -> tuple[UUID, UUID | None]:
        if scoped_context.galaxy_id is None:
            scoped_context.galaxy_id = await resolve_galaxy_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=payload.galaxy_id,
                services=services,
            )
            scoped_context.branch_id = await resolve_branch_id_for_user(
                session=session,
                user=current_user,
                galaxy_id=scoped_context.galaxy_id,
                branch_id=payload.branch_id,
                services=services,
            )
        return scoped_context.galaxy_id, scoped_context.branch_id

    resolution = await resolve_plan_for_payload(
        payload=payload,
        session=session,
        current_user_id=current_user.id,
        services=services,
        ensure_scope=ensure_scope,
    )
    tasks = resolution.tasks

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/parser/execute",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "command": payload.command,
            "resolved_command": resolution.resolved_command,
            "alias_used": resolution.alias_used,
            "alias_version": resolution.alias_version,
            "parser_version": payload.parser_version,
        },
        map_execution=lambda execution: execution_to_response(tasks=tasks, execution=execution),
        replay_loader=ParseCommandResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Parser execution failed",
        resolved_scope=scoped_context.resolved_scope,
    )
