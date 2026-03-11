from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.bonds.policy import canonical_bond_pair, resolve_validation_decision
from app.domains.bonds.schemas import (
    BondValidateNormalized,
    BondValidatePreview,
    BondValidateReason,
    BondValidateRequest,
    BondValidateResponse,
)
from app.domains.bonds.semantics import bond_semantics, normalize_bond_type


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


def _occ_conflict_reason(*, entity: str, expected_event_seq: int, actual_event_seq: int) -> BondValidateReason:
    return BondValidateReason(
        code="BOND_VALIDATE_OCC_CONFLICT",
        message="Optimistic concurrency check failed for preview request.",
        context={
            "entity": entity,
            "expected_event_seq": int(expected_event_seq),
            "actual_event_seq": int(actual_event_seq),
        },
    )


def _find_existing_create_bond(
    *,
    active_bonds: list[Any],
    normalized_source: UUID,
    normalized_target: UUID,
    relation_type: str,
) -> Any | None:
    for bond in active_bonds:
        bond_type = normalize_bond_type(getattr(bond, "type", "RELATION"))
        if bond_type != relation_type:
            continue
        source_id = getattr(bond, "source_civilization_id", None)
        target_id = getattr(bond, "target_civilization_id", None)
        if not isinstance(source_id, UUID) or not isinstance(target_id, UUID):
            continue
        if bond_type == "RELATION":
            candidate_source, candidate_target = canonical_bond_pair(
                source_id,
                target_id,
                relation_type=bond_type,
            )
            if candidate_source == normalized_source and candidate_target == normalized_target:
                return bond
            continue
        if source_id == normalized_source and target_id == normalized_target:
            return bond
    return None


def _find_bond_by_id(*, active_bonds: list[Any], bond_id: UUID | None) -> Any | None:
    if bond_id is None:
        return None
    for bond in active_bonds:
        if getattr(bond, "id", None) == bond_id:
            return bond
    return None


async def validate_bond_request(
    *,
    session: AsyncSession,
    services: Any,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    payload: BondValidateRequest,
) -> BondValidateResponse:
    semantics = bond_semantics(payload.type)
    operation = str(payload.operation or "create").strip().lower()

    normalized_source = payload.source_civilization_id
    normalized_target = payload.target_civilization_id
    if operation == "create" and normalized_source is not None and normalized_target is not None:
        normalized_source, normalized_target = canonical_bond_pair(
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
    target_bond: Any | None = None
    source_civilization: Any | None = None
    target_civilization: Any | None = None
    projection_loaded = False

    try:
        active_civilizations, active_bonds = await services.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            apply_calculations=False,
        )
        projection_loaded = True
    except HTTPException as exc:
        reasons.append(_reason_from_http_exception(exc))
        active_civilizations = []
        active_bonds = []

    civilizations_by_id = {
        item.id: item for item in active_civilizations if isinstance(getattr(item, "id", None), UUID)
    }

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

        if projection_loaded:
            source_civilization = civilizations_by_id.get(normalized_source) if normalized_source is not None else None
            target_civilization = civilizations_by_id.get(normalized_target) if normalized_target is not None else None
            if source_civilization is None:
                reasons.append(
                    BondValidateReason(
                        code="BOND_VALIDATE_SOURCE_MISSING",
                        message="Source civilization is missing in resolved scope.",
                    )
                )
            if target_civilization is None:
                reasons.append(
                    BondValidateReason(
                        code="BOND_VALIDATE_TARGET_MISSING",
                        message="Target civilization is missing in resolved scope.",
                    )
                )

        if projection_loaded and source_civilization is not None and target_civilization is not None:
            source_planet_id = getattr(source_civilization, "table_id", None)
            target_planet_id = getattr(target_civilization, "table_id", None)
            cross_planet = (
                isinstance(source_planet_id, UUID)
                and isinstance(target_planet_id, UUID)
                and str(source_planet_id) != str(target_planet_id)
            )

            if payload.expected_source_event_seq is not None:
                source_seq = int(getattr(source_civilization, "current_event_seq", 0) or 0)
                if int(payload.expected_source_event_seq) != source_seq:
                    reasons.append(
                        _occ_conflict_reason(
                            entity="source_civilization",
                            expected_event_seq=payload.expected_source_event_seq,
                            actual_event_seq=source_seq,
                        )
                    )
            if payload.expected_target_event_seq is not None:
                target_seq = int(getattr(target_civilization, "current_event_seq", 0) or 0)
                if int(payload.expected_target_event_seq) != target_seq:
                    reasons.append(
                        _occ_conflict_reason(
                            entity="target_civilization",
                            expected_event_seq=payload.expected_target_event_seq,
                            actual_event_seq=target_seq,
                        )
                    )

            existing_bond = _find_existing_create_bond(
                active_bonds=active_bonds,
                normalized_source=normalized_source,
                normalized_target=normalized_target,
                relation_type=semantics.bond_type,
            )
            if existing_bond is not None:
                existing_bond_id = existing_bond.id

    elif operation in {"mutate", "extinguish"}:
        if projection_loaded:
            target_bond = _find_bond_by_id(active_bonds=active_bonds, bond_id=payload.bond_id)
        if projection_loaded and target_bond is None:
            reasons.append(
                BondValidateReason(
                    code="BOND_VALIDATE_BOND_MISSING",
                    message="Requested bond does not exist in resolved scope.",
                )
            )
        if projection_loaded and target_bond is not None:
            existing_bond_id = target_bond.id
            expected_bond_seq = payload.expected_bond_event_seq
            if expected_bond_seq is not None:
                bond_seq = int(getattr(target_bond, "current_event_seq", 0) or 0)
                if int(expected_bond_seq) != bond_seq:
                    reasons.append(
                        _occ_conflict_reason(
                            entity="bond",
                            expected_event_seq=expected_bond_seq,
                            actual_event_seq=bond_seq,
                        )
                    )

    preview = BondValidatePreview(
        cross_planet=cross_planet,
        source_planet_id=source_planet_id if isinstance(source_planet_id, UUID) else None,
        target_planet_id=target_planet_id if isinstance(target_planet_id, UUID) else None,
        existing_bond_id=existing_bond_id,
    )

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

    decision, accepted, blocking = resolve_validation_decision(reasons=reasons)
    preview.would_create = (
        operation == "create"
        and accepted
        and not blocking
        and existing_bond_id is None
        and source_civilization is not None
        and target_civilization is not None
    )
    preview.would_replace = (
        operation == "mutate"
        and accepted
        and not blocking
        and target_bond is not None
        and normalize_bond_type(getattr(target_bond, "type", "RELATION")) != semantics.bond_type
    )
    preview.would_extinguish = operation == "extinguish" and accepted and not blocking and target_bond is not None

    return BondValidateResponse(
        decision=decision,  # type: ignore[arg-type]
        accepted=accepted,
        blocking=blocking,
        normalized=normalized,
        preview=preview,
        reasons=reasons,
    )


__all__ = ["validate_bond_request"]
