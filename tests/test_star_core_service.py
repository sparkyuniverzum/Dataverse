from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.services.star_core_service import StarCoreService


@dataclass
class _EventStub:
    event_seq: int
    event_type: str
    entity_id: uuid.UUID
    payload: dict
    timestamp: datetime


class _EventStoreStub:
    def __init__(self, events: list[_EventStub]) -> None:
        self._events = sorted(events, key=lambda item: item.event_seq)

    async def latest_event_seq(self, *, session, user_id, galaxy_id, branch_id=None) -> int:  # noqa: ANN001, ANN201
        del session, user_id, galaxy_id, branch_id
        if not self._events:
            return 0
        return int(self._events[-1].event_seq)

    async def list_events_after(  # noqa: ANN001, ANN201
        self,
        *,
        session,
        user_id,
        galaxy_id,
        branch_id=None,
        after_event_seq: int,
        limit: int,
    ) -> list[_EventStub]:
        del session, user_id, galaxy_id, branch_id
        return [item for item in self._events if item.event_seq > after_event_seq][:limit]


class _UniverseServiceStub:
    def __init__(self, tables: list[dict]) -> None:
        self._tables = tables

    async def tables_snapshot(self, *, session, user_id, galaxy_id, branch_id=None, as_of=None):  # noqa: ANN001, ANN201
        del session, user_id, galaxy_id, branch_id, as_of
        return list(self._tables)


class _ConstellationDashboardServiceStub:
    def __init__(self, items: list[dict]) -> None:
        self._items = items

    async def list_constellations(self, *, session, user_id, galaxy_id, branch_id=None, as_of=None):  # noqa: ANN001, ANN201
        del session, user_id, galaxy_id, branch_id, as_of
        return list(self._items)


def test_star_core_runtime_returns_zero_state_when_no_events() -> None:
    service = StarCoreService(event_store=_EventStoreStub(events=[]))
    result = asyncio.run(
        service.get_runtime(
            session=None,  # type: ignore[arg-type]
            user_id=uuid.uuid4(),
            galaxy_id=uuid.uuid4(),
            branch_id=None,
            window_events=64,
        )
    )
    assert result["as_of_event_seq"] == 0
    assert result["events_count"] == 0
    assert result["writes_per_minute"] == 0.0


def test_star_core_pulse_derives_visual_hints_from_event_types() -> None:
    now = datetime.now(UTC)
    events = [
        _EventStub(
            event_seq=101,
            event_type="INGEST",
            entity_id=uuid.uuid4(),
            payload={},
            timestamp=now,
        ),
        _EventStub(
            event_seq=102,
            event_type="UPDATE_ASTEROID",
            entity_id=uuid.uuid4(),
            payload={"phase": "x"},
            timestamp=now + timedelta(seconds=10),
        ),
        _EventStub(
            event_seq=103,
            event_type="ASTEROID_SOFT_DELETED",
            entity_id=uuid.uuid4(),
            payload={"is_deleted": True},
            timestamp=now + timedelta(seconds=20),
        ),
    ]
    service = StarCoreService(event_store=_EventStoreStub(events=events))
    result = asyncio.run(
        service.list_pulse(
            session=None,  # type: ignore[arg-type]
            user_id=uuid.uuid4(),
            galaxy_id=uuid.uuid4(),
            branch_id=None,
            after_event_seq=100,
            limit=10,
        )
    )
    assert result["sampled_count"] == 3
    hints = [item["visual_hint"] for item in result["events"]]
    assert hints == ["source_shockwave", "surface_pulse", "fade_to_singularity"]


def test_star_core_domain_metrics_returns_domain_activity_from_recent_events() -> None:
    table_id = uuid.uuid4()
    moon_a = uuid.uuid4()
    moon_b = uuid.uuid4()
    now = datetime.now(UTC)
    events = [
        _EventStub(
            event_seq=201,
            event_type="ASTEROID_CREATED",
            entity_id=moon_a,
            payload={"value": "A"},
            timestamp=now,
        ),
        _EventStub(
            event_seq=202,
            event_type="METADATA_UPDATED",
            entity_id=moon_b,
            payload={"metadata": {"phase": "active"}},
            timestamp=now + timedelta(seconds=30),
        ),
        _EventStub(
            event_seq=203,
            event_type="ASTEROID_VALUE_UPDATED",
            entity_id=uuid.uuid4(),
            payload={"metadata": {"table_id": str(table_id)}},
            timestamp=now + timedelta(seconds=60),
        ),
    ]
    service = StarCoreService(
        event_store=_EventStoreStub(events=events),
        universe_service=_UniverseServiceStub(
            tables=[
                {
                    "table_id": str(table_id),
                    "constellation_name": "Finance",
                    "members": [{"id": str(moon_a)}, {"id": str(moon_b)}],
                    "internal_bonds": [],
                    "external_bonds": [],
                }
            ]
        ),
        constellation_dashboard_service=_ConstellationDashboardServiceStub(
            items=[
                {
                    "name": "Finance",
                    "planets_count": 1,
                    "moons_count": 2,
                    "internal_bonds_count": 0,
                    "external_bonds_count": 0,
                    "guardian_rules_count": 0,
                    "alerted_moons_count": 0,
                    "circular_fields_count": 0,
                    "quality_score": 96,
                    "status": "GREEN",
                }
            ]
        ),
    )

    result = asyncio.run(
        service.get_domain_metrics(
            session=None,  # type: ignore[arg-type]
            user_id=uuid.uuid4(),
            galaxy_id=uuid.uuid4(),
            branch_id=None,
            window_events=64,
        )
    )
    assert result["sampled_window_size"] == 64
    assert result["total_events_count"] == 3
    assert result["domains"]
    finance = next((item for item in result["domains"] if item["domain_name"] == "Finance"), None)
    assert finance is not None
    assert finance["status"] == "GREEN"
    assert finance["events_count"] == 3
    assert finance["activity_intensity"] >= 0.0
