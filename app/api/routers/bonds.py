from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.execution import bond_to_response
from app.api.runtime import (
    get_service_container,
    resolve_scope_for_user,
    run_scoped_atomic_idempotent,
    transactional_context,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    BondCreateRequest,
    BondMutateRequest,
    BondResponse,
    BondValidateNormalized,
    BondValidatePreview,
    BondValidateReason,
    BondValidateRequest,
    BondValidateResponse,
)
from app.services.bond_semantics import bond_semantics, normalize_bond_type
from app.services.parser_types import AtomicTask

router = APIRouter(tags=["bonds"])


def _canonical_pair(
    source_civilization_id: UUID, target_civilization_id: UUID, *, relation_type: str
) -> tuple[UUID, UUID]:
    if normalize_bond_type(relation_type) != "RELATION":
        return source_civilization_id, target_civilization_id
    source_text = str(source_civilization_id)
    target_text = str(target_civilization_id)
    if source_text <= target_text:
        return source_civilization_id, target_civilization_id
    return target_civilization_id, source_civilization_id


def _reason_from_http_exception(exc: HTTPException) -> BondValidateReason:
    detail = exc.detail
    status_code = int(exc.status_code or 500)
    detail_text = str(detail or "").lower()
    detail_dict = detail if isinstance(detail, dict) else {}
    detail_code = str(detail_dict.get("code") or "").strip().upper()

    if status_code == status.HTTP_404_NOT_FOUND:
        if "source" in detail_text:
            return BondValidateReason(
                code="BOND_VALIDATE_SOURCE_MISSING",
                message="Source civilization is missing in resolved scope.",
                context={"status": status_code, "detail": detail},
            )
        if "target" in detail_text:
            return BondValidateReason(
                code="BOND_VALIDATE_TARGET_MISSING",
                message="Target civilization is missing in resolved scope.",
                context={"status": status_code, "detail": detail},
            )
        return BondValidateReason(
            code="BOND_VALIDATE_BOND_MISSING",
            message="Requested bond does not exist in resolved scope.",
            context={"status": status_code, "detail": detail},
        )

    if status_code == status.HTTP_409_CONFLICT:
        if detail_code == "OCC_CONFLICT":
            return BondValidateReason(
                code="BOND_VALIDATE_OCC_CONFLICT",
                message="Optimistic concurrency check failed for preview request.",
                context={"status": status_code, "detail": detail},
            )
        if detail_code == "BOND_TYPE_CONFLICT":
            return BondValidateReason(
                code="BOND_VALIDATE_DUPLICATE_EDGE",
                message="Target bond type already exists for this edge.",
                context={"status": status_code, "detail": detail},
            )
        return BondValidateReason(
            code="BOND_VALIDATE_DUPLICATE_EDGE",
            message="Bond edge would conflict with existing relation.",
            context={"status": status_code, "detail": detail},
        )

    if "source_civilization_id and target_civilization_id must be different" in detail_text:
        return BondValidateReason(
            code="BOND_VALIDATE_SAME_ENDPOINT",
            message="Source and target civilization must be different.",
            context={"status": status_code, "detail": detail},
        )

    if status_code == status.HTTP_403_FORBIDDEN:
        return BondValidateReason(
            code="BOND_VALIDATE_SCOPE_FORBIDDEN",
            message="Resolved scope does not allow this bond operation.",
            context={"status": status_code, "detail": detail},
        )

    return BondValidateReason(
        code="BOND_VALIDATE_TYPE_FORBIDDEN",
        message="Bond preview rejected by runtime validation.",
        context={"status": status_code, "detail": detail},
    )


def _resolve_decision(*, reasons: list[BondValidateReason]) -> tuple[str, bool, bool]:
    if not reasons:
        return "ALLOW", True, False
    blocking = any(item.blocking for item in reasons)
    if blocking:
        return "REJECT", False, True
    return "WARN", True, False


@router.post("/bonds/validate", response_model=BondValidateResponse, status_code=status.HTTP_200_OK)
async def validate_bond(
    payload: BondValidateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondValidateResponse:
    class _PreviewRollback(Exception):
        pass

    resolved_galaxy_id, resolved_branch_id = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    semantics = bond_semantics(payload.type)
    operation = str(payload.operation or "create").strip().lower()

    normalized_source = payload.source_civilization_id
    normalized_target = payload.target_civilization_id
    if operation == "create" and normalized_source is not None and normalized_target is not None:
        normalized_source, normalized_target = _canonical_pair(
            normalized_source,
            normalized_target,
            relation_type=semantics.bond_type,
        )

    normalized = BondValidateNormalized(
        source_civilization_id=normalized_source,
        target_civilization_id=normalized_target,
        type=semantics.bond_type,
        directional=semantics.directional,
        flow_direction=semantics.flow_direction,
        canonical_pair=(
            f"{normalized_source}<->{normalized_target}"
            if normalized_source is not None and normalized_target is not None
            else None
        ),
    )

    reasons: list[BondValidateReason] = []
    source_planet_id: UUID | None = None
    target_planet_id: UUID | None = None
    cross_planet = False
    existing_bond_id: UUID | None = None
    try:
        active_asteroids, active_bonds = await services.universe_service.project_state(
            session=session,
            user_id=current_user.id,
            galaxy_id=resolved_galaxy_id,
            branch_id=resolved_branch_id,
            apply_calculations=False,
        )
        asteroid_by_id = {item.id: item for item in active_asteroids}
        source_asteroid = asteroid_by_id.get(normalized_source) if normalized_source is not None else None
        target_asteroid = asteroid_by_id.get(normalized_target) if normalized_target is not None else None
        source_planet_id = source_asteroid.table_id if source_asteroid is not None else None
        target_planet_id = target_asteroid.table_id if target_asteroid is not None else None
        cross_planet = (
            source_planet_id is not None
            and target_planet_id is not None
            and str(source_planet_id) != str(target_planet_id)
        )

        if operation == "create" and normalized_source is not None and normalized_target is not None:
            for bond in active_bonds:
                bond_type = normalize_bond_type(bond.type)
                if bond_type != semantics.bond_type:
                    continue
                if bond_type == "RELATION":
                    candidate_source, candidate_target = _canonical_pair(
                        bond.source_civilization_id,
                        bond.target_civilization_id,
                        relation_type=bond_type,
                    )
                    if candidate_source == normalized_source and candidate_target == normalized_target:
                        existing_bond_id = bond.id
                        break
                    continue
                if (
                    bond.source_civilization_id == normalized_source
                    and bond.target_civilization_id == normalized_target
                ):
                    existing_bond_id = bond.id
                    break
    except HTTPException as exc:
        reasons.append(_reason_from_http_exception(exc))

    preview = BondValidatePreview(
        cross_planet=cross_planet,
        source_planet_id=source_planet_id,
        target_planet_id=target_planet_id,
        existing_bond_id=existing_bond_id,
    )

    execution = None
    tasks: list[AtomicTask] = []
    if operation == "create":
        if payload.source_civilization_id == payload.target_civilization_id:
            reasons.append(
                BondValidateReason(
                    code="BOND_VALIDATE_SAME_ENDPOINT",
                    message="Source and target civilization must be different.",
                    context={
                        "source_civilization_id": str(payload.source_civilization_id),
                        "target_civilization_id": str(payload.target_civilization_id),
                    },
                )
            )
        tasks = [
            AtomicTask(
                action="LINK",
                params={
                    "source_civilization_id": str(payload.source_civilization_id),
                    "target_civilization_id": str(payload.target_civilization_id),
                    "type": semantics.bond_type,
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
    elif operation == "mutate":
        tasks = [
            AtomicTask(
                action="UPDATE_BOND",
                params={
                    "bond_id": str(payload.bond_id),
                    "type": semantics.bond_type,
                    **(
                        {"expected_event_seq": payload.expected_bond_event_seq}
                        if payload.expected_bond_event_seq is not None
                        else {}
                    ),
                },
            )
        ]
    elif operation == "extinguish":
        tasks = [
            AtomicTask(
                action="EXTINGUISH_BOND",
                params={
                    "bond_id": str(payload.bond_id),
                    **(
                        {"expected_event_seq": payload.expected_bond_event_seq}
                        if payload.expected_bond_event_seq is not None
                        else {}
                    ),
                },
            )
        ]

    if not reasons:
        try:
            async with transactional_context(session):
                try:
                    async with session.begin_nested():
                        execution = await services.task_executor_service.execute_tasks(
                            session=session,
                            tasks=tasks,
                            user_id=current_user.id,
                            galaxy_id=resolved_galaxy_id,
                            branch_id=resolved_branch_id,
                            manage_transaction=False,
                        )
                        # Dry-run only; always rollback savepoint.
                        raise _PreviewRollback()
                except _PreviewRollback:
                    pass
        except HTTPException as exc:
            reasons.append(_reason_from_http_exception(exc))

    if not reasons and operation == "create" and existing_bond_id is not None:
        reasons.append(
            BondValidateReason(
                code="BOND_VALIDATE_EDGE_REUSE",
                severity="warning",
                blocking=False,
                message="Existing bond already satisfies requested relation.",
                context={"existing_bond_id": str(existing_bond_id)},
            )
        )
    if not reasons and cross_planet:
        reasons.append(
            BondValidateReason(
                code="BOND_VALIDATE_CROSS_PLANET_WARN",
                severity="warning",
                blocking=False,
                message="Cross-planet relation detected; verify policy compatibility before commit.",
                context={
                    "source_planet_id": str(source_planet_id) if source_planet_id is not None else None,
                    "target_planet_id": str(target_planet_id) if target_planet_id is not None else None,
                },
            )
        )

    decision, accepted, blocking = _resolve_decision(reasons=reasons)
    preview.would_create = (
        operation == "create"
        and accepted
        and not blocking
        and existing_bond_id is None
        and bool(execution and execution.bonds)
    )
    preview.would_replace = (
        operation == "mutate" and accepted and not blocking and bool(execution and execution.extinguished_bond_ids)
    )
    preview.would_extinguish = operation == "extinguish" and accepted and not blocking

    return BondValidateResponse(
        decision=decision,  # type: ignore[arg-type]
        accepted=accepted,
        blocking=blocking,
        normalized=normalized,
        preview=preview,
        reasons=reasons,
    )


@router.post("/bonds/link", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def link_bond(
    payload: BondCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="LINK",
            params={
                "source_civilization_id": str(payload.source_civilization_id),
                "target_civilization_id": str(payload.target_civilization_id),
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

    def map_execution(execution) -> BondResponse:
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Bond link failed")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/bonds/link",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "source_civilization_id": str(payload.source_civilization_id),
            "target_civilization_id": str(payload.target_civilization_id),
            "type": payload.type,
            "expected_source_event_seq": payload.expected_source_event_seq,
            "expected_target_event_seq": payload.expected_target_event_seq,
        },
        map_execution=map_execution,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond link failed",
    )


@router.patch("/bonds/{bond_id}/mutate", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def mutate_bond(
    bond_id: UUID,
    payload: BondMutateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="UPDATE_BOND",
            params={
                "bond_id": str(bond_id),
                "type": payload.type,
                **(
                    {"expected_event_seq": payload.expected_event_seq} if payload.expected_event_seq is not None else {}
                ),
            },
        )
    ]

    def map_execution(execution) -> BondResponse:
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[-1])

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/mutate",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "bond_id": str(bond_id),
            "type": payload.type,
            "expected_event_seq": payload.expected_event_seq,
        },
        map_execution=map_execution,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )


@router.patch("/bonds/{bond_id}/extinguish", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def extinguish_bond(
    bond_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    expected_event_seq: int | None = Query(default=None, ge=0),
    idempotency_key: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> BondResponse:
    params: dict[str, Any] = {"bond_id": str(bond_id)}
    if expected_event_seq is not None:
        params["expected_event_seq"] = expected_event_seq
    tasks = [AtomicTask(action="EXTINGUISH_BOND", params=params)]

    def map_execution(execution) -> BondResponse:
        if not execution.bonds:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bond not found")
        return bond_to_response(execution.bonds[0])

    return await run_scoped_atomic_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        tasks=tasks,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        endpoint_key="PATCH:/bonds/{bond_id}/extinguish",
        idempotency_key=idempotency_key,
        request_payload={"bond_id": str(bond_id), "expected_event_seq": expected_event_seq},
        map_execution=map_execution,
        replay_loader=BondResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Bond not found",
        empty_response_status=status.HTTP_404_NOT_FOUND,
    )
