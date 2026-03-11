import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.parser2 import SnapshotSemanticResolver
from app.services.universe_service import ProjectedAsteroid


def _asteroid(civilization_id: str, value: object) -> ProjectedAsteroid:
    return ProjectedAsteroid(
        id=UUID(civilization_id),
        value=value,
        metadata={},
        is_deleted=False,
        created_at=datetime.now(UTC),
        deleted_at=None,
    )


def test_snapshot_resolver_resolves_exact_name_case_insensitively() -> None:
    resolver = SnapshotSemanticResolver(
        [
            _asteroid("11111111-1111-1111-1111-111111111111", "Erik"),
            _asteroid("22222222-2222-2222-2222-222222222222", "Projekt Alfa"),
        ]
    )

    resolved = resolver.resolve_node("erik")
    assert resolved is not None
    assert resolved.value == "11111111-1111-1111-1111-111111111111"


def test_snapshot_resolver_resolves_unique_contains_match() -> None:
    resolver = SnapshotSemanticResolver(
        [
            _asteroid("11111111-1111-1111-1111-111111111111", "Projekt Alfa"),
            _asteroid("22222222-2222-2222-2222-222222222222", "Finance"),
        ]
    )

    resolved = resolver.resolve_node("alfa")
    assert resolved is not None
    assert resolved.value == "11111111-1111-1111-1111-111111111111"


def test_snapshot_resolver_returns_none_for_ambiguous_contains() -> None:
    resolver = SnapshotSemanticResolver(
        [
            _asteroid("11111111-1111-1111-1111-111111111111", "Projekt Alfa"),
            _asteroid("22222222-2222-2222-2222-222222222222", "Projekt Beta"),
        ]
    )

    assert resolver.resolve_node("projekt") is None
    issue = resolver.unresolved_issue("projekt")
    assert issue is not None
    assert issue[0] == "PLAN_RESOLVE_AMBIGUOUS_NAME"


def test_snapshot_resolver_returns_none_for_ambiguous_exact_normalized() -> None:
    resolver = SnapshotSemanticResolver(
        [
            _asteroid("11111111-1111-1111-1111-111111111111", "Erik"),
            _asteroid("22222222-2222-2222-2222-222222222222", "ERIK"),
        ]
    )

    assert resolver.resolve_node("erik") is None
    issue = resolver.unresolved_issue("erik")
    assert issue is not None
    assert issue[0] == "PLAN_RESOLVE_AMBIGUOUS_NAME"


def test_snapshot_resolver_reports_not_found_issue() -> None:
    resolver = SnapshotSemanticResolver(
        [
            _asteroid("11111111-1111-1111-1111-111111111111", "Erik"),
        ]
    )

    assert resolver.resolve_node("jana") is None
    issue = resolver.unresolved_issue("jana")
    assert issue is not None
    assert issue[0] == "PLAN_RESOLVE_NOT_FOUND"
