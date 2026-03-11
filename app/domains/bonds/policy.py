from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from app.domains.bonds.semantics import normalize_bond_type


class _BlockingReason(Protocol):
    blocking: bool


def canonical_bond_pair(
    source_civilization_id: UUID,
    target_civilization_id: UUID,
    *,
    relation_type: str,
) -> tuple[UUID, UUID]:
    if normalize_bond_type(relation_type) != "RELATION":
        return source_civilization_id, target_civilization_id
    source_text = str(source_civilization_id)
    target_text = str(target_civilization_id)
    if source_text <= target_text:
        return source_civilization_id, target_civilization_id
    return target_civilization_id, source_civilization_id


def resolve_validation_decision(*, reasons: Sequence[_BlockingReason]) -> tuple[str, bool, bool]:
    if not reasons:
        return "ALLOW", True, False
    blocking = any(item.blocking for item in reasons)
    if blocking:
        return "REJECT", False, True
    return "WARN", True, False
