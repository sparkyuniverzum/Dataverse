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
    ParseCommandPreviewResponse,
    ParseCommandPreviewRiskFlags,
    ParseCommandPreviewScope,
    ParseCommandRequest,
    ParseCommandResponse,
    ParserAliasesResponse,
    ParserAliasMutationResponse,
    ParserAliasPatchRequest,
    ParserAliasRecord,
    ParserAliasUpsertRequest,
)

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
    risk_flags = _build_risk_flags(normalized_tasks, branch_id=scoped_context.branch_id)
    expected_events = _build_expected_event_preview(normalized_tasks)
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
