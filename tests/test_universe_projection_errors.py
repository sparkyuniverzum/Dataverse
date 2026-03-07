from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.universe.tables_snapshot import build_tables_snapshot
from app.services.universe_service import UniverseService


class _FakeEventStore:
    async def list_events(self, **kwargs):
        return [
            SimpleNamespace(
                id=uuid4(),
                user_id=kwargs["user_id"],
                galaxy_id=kwargs["galaxy_id"],
                branch_id=kwargs.get("branch_id"),
                entity_id=uuid4(),
                event_type="BOND_FORMED",
                payload={
                    "source_civilization_id": "not-a-uuid",
                    "target_civilization_id": str(uuid4()),
                    "type": "RELATION",
                },
                timestamp=datetime.now(UTC),
                event_seq=1,
            )
        ]


class _ReplayLoadEventStore:
    def __init__(self, events: list[SimpleNamespace]) -> None:
        self._events = list(events)

    async def list_events(self, **kwargs):
        target_user_id = kwargs.get("user_id")
        target_galaxy_id = kwargs.get("galaxy_id")
        target_branch_id = kwargs.get("branch_id")
        as_of = kwargs.get("as_of")
        up_to_event_seq = kwargs.get("up_to_event_seq")

        rows: list[SimpleNamespace] = []
        for event in self._events:
            if target_user_id is not None and event.user_id != target_user_id:
                continue
            if target_galaxy_id is not None and event.galaxy_id != target_galaxy_id:
                continue
            if target_branch_id is None:
                if event.branch_id is not None:
                    continue
            elif event.branch_id != target_branch_id:
                continue
            if as_of is not None and event.timestamp > as_of:
                continue
            if up_to_event_seq is not None and int(event.event_seq) > int(up_to_event_seq):
                continue
            rows.append(event)
        return rows


def test_project_state_from_events_rejects_malformed_bond_payload() -> None:
    service = UniverseService(event_store=_FakeEventStore())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            service._project_state_from_events(
                session=None,
                user_id=uuid4(),
                galaxy_id=uuid4(),
                branch_id=None,
                as_of=None,
            )
        )

    assert exc.value.status_code == 500
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("code") == "UNIVERSE_EVENT_PAYLOAD_INVALID"
    assert exc.value.detail.get("event_type") == "BOND_FORMED"


def test_projection_replay_convergence_under_load() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    asteroid_count = 320
    base_ts = datetime(2026, 3, 6, 12, 0, 0, tzinfo=UTC)

    events: list[SimpleNamespace] = []
    asteroid_ids: list[UUID] = [uuid4() for _ in range(asteroid_count)]
    bond_ids_by_index: dict[int, UUID] = {}
    deleted_bond_ids: set[UUID] = set()
    sequence = 0

    def append_event(event_type: str, entity_id: UUID, payload: dict) -> None:
        nonlocal sequence
        sequence += 1
        events.append(
            SimpleNamespace(
                id=uuid4(),
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=None,
                entity_id=entity_id,
                event_type=event_type,
                payload=payload,
                timestamp=base_ts + timedelta(milliseconds=sequence),
                event_seq=sequence,
            )
        )

    for idx, asteroid_id in enumerate(asteroid_ids):
        append_event(
            "ASTEROID_CREATED",
            asteroid_id,
            {
                "value": f"LoadRow-{idx}",
                "metadata": {
                    "table": f"Load > Planet-{idx % 9}",
                    "entity_id": f"load-{idx:04d}",
                    "state": "active",
                },
            },
        )
        if idx % 2 == 0:
            append_event(
                "METADATA_UPDATED",
                asteroid_id,
                {"metadata": {"batch": idx % 7, "kind": "replay-load"}},
            )
        if idx % 3 == 0:
            append_event(
                "ASTEROID_VALUE_UPDATED",
                asteroid_id,
                {"value": f"LoadRow-{idx}-v2"},
            )

    for idx in range(asteroid_count - 1):
        bond_id = uuid4()
        bond_ids_by_index[idx] = bond_id
        append_event(
            "BOND_FORMED",
            bond_id,
            {
                "source_civilization_id": str(asteroid_ids[idx]),
                "target_civilization_id": str(asteroid_ids[idx + 1]),
                "type": "RELATION",
            },
        )
        if idx % 7 == 0:
            append_event("BOND_SOFT_DELETED", bond_id, {})
            deleted_bond_ids.add(bond_id)

    deleted_asteroid_ids: set[UUID] = set()
    for idx, asteroid_id in enumerate(asteroid_ids):
        if idx % 5 == 0:
            append_event("ASTEROID_SOFT_DELETED", asteroid_id, {})
            deleted_asteroid_ids.add(asteroid_id)

    assert len(events) >= 1000

    service = UniverseService(event_store=_ReplayLoadEventStore(events))
    first_asteroids, first_bonds = asyncio.run(
        service._project_state_from_events(
            session=None,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            as_of=None,
        )
    )
    replay_asteroids, replay_bonds = asyncio.run(
        service._project_state_from_events(
            session=None,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            as_of=None,
        )
    )

    expected_active_asteroid_ids = {
        asteroid_id for asteroid_id in asteroid_ids if asteroid_id not in deleted_asteroid_ids
    }
    assert len(first_asteroids) == len(expected_active_asteroid_ids)
    assert {item.id for item in first_asteroids} == expected_active_asteroid_ids
    assert [item.id for item in first_asteroids] == [item.id for item in replay_asteroids]
    assert [item.current_event_seq for item in first_asteroids] == [item.current_event_seq for item in replay_asteroids]

    expected_active_bond_ids: set[UUID] = set()
    for idx, bond_id in bond_ids_by_index.items():
        if bond_id in deleted_bond_ids:
            continue
        source_civilization_id = asteroid_ids[idx]
        target_civilization_id = asteroid_ids[idx + 1]
        if (
            source_civilization_id in expected_active_asteroid_ids
            and target_civilization_id in expected_active_asteroid_ids
        ):
            expected_active_bond_ids.add(bond_id)

    assert {item.id for item in first_bonds} == expected_active_bond_ids
    assert [item.id for item in first_bonds] == [item.id for item in replay_bonds]
    for bond in first_bonds:
        assert bond.source_civilization_id in expected_active_asteroid_ids
        assert bond.target_civilization_id in expected_active_asteroid_ids

    table_rows = build_tables_snapshot(
        service,
        galaxy_id=galaxy_id,
        asteroids=first_asteroids,
        bonds=first_bonds,
        contract_hints={},
    )
    table_member_ids = {UUID(str(member["id"])) for table in table_rows for member in (table.get("members") or [])}
    assert table_member_ids == expected_active_asteroid_ids

    for table in table_rows:
        for bond in table.get("internal_bonds", []):
            assert UUID(str(bond["id"])) in expected_active_bond_ids
            assert UUID(str(bond["source_civilization_id"])) in expected_active_asteroid_ids
            assert UUID(str(bond["target_civilization_id"])) in expected_active_asteroid_ids
        for bond in table.get("external_bonds", []):
            assert UUID(str(bond["id"])) in expected_active_bond_ids
            assert UUID(str(bond["source_civilization_id"])) in expected_active_asteroid_ids
            assert UUID(str(bond["target_civilization_id"])) in expected_active_asteroid_ids


def test_projection_replay_applies_metadata_remove_patch() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    asteroid_id = uuid4()
    base_ts = datetime(2026, 3, 6, 12, 30, 0, tzinfo=UTC)
    events = [
        SimpleNamespace(
            id=uuid4(),
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_id=asteroid_id,
            event_type="ASTEROID_CREATED",
            payload={
                "value": "Metadata remove seed",
                "metadata": {
                    "table": "Replay > Minerals",
                    "entity_id": "seed-1",
                    "state": "active",
                    "segment": "core",
                },
            },
            timestamp=base_ts,
            event_seq=1,
        ),
        SimpleNamespace(
            id=uuid4(),
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_id=asteroid_id,
            event_type="METADATA_UPDATED",
            payload={"metadata": {}, "metadata_remove": ["segment"]},
            timestamp=base_ts + timedelta(milliseconds=1),
            event_seq=2,
        ),
    ]
    service = UniverseService(event_store=_ReplayLoadEventStore(events))
    asteroids, bonds = asyncio.run(
        service._project_state_from_events(
            session=None,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            as_of=None,
        )
    )
    assert bonds == []
    assert len(asteroids) == 1
    asteroid = asteroids[0]
    assert asteroid.id == asteroid_id
    assert asteroid.current_event_seq == 2
    assert asteroid.metadata.get("state") == "active"
    assert "segment" not in asteroid.metadata
