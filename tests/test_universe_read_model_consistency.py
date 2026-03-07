from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

from app.services.universe import read_model_projection as rm_projection
from app.services.universe.types import ProjectedAsteroid


def test_enrich_main_timeline_falls_back_when_calc_state_is_stale(monkeypatch) -> None:
    civilization_id = uuid4()
    galaxy_id = uuid4()
    user_id = uuid4()

    civilization = ProjectedAsteroid(
        id=civilization_id,
        value="Civilization row",
        metadata={"table": "Core > Planet", "state": "archived"},
        is_deleted=False,
        created_at=datetime.now(UTC),
        deleted_at=None,
        current_event_seq=12,
    )

    async def fake_load_calc(*args, **kwargs):  # noqa: ANN002, ANN003
        return {
            civilization_id: {
                "calculated_values": {"state": "active"},
                "calc_errors": [],
                "source_event_seq": 11,
                "engine_version": "calc-v1",
            }
        }

    async def fake_load_physics(*args, **kwargs):  # noqa: ANN002, ANN003
        return {}

    monkeypatch.setattr(rm_projection, "_load_calc_state_by_civilization_id", fake_load_calc)
    monkeypatch.setattr(rm_projection, "_load_physics_state_by_civilization_id", fake_load_physics)

    result = asyncio.run(
        rm_projection.enrich_main_timeline_from_read_models(
            session=None,
            user_id=user_id,
            galaxy_id=galaxy_id,
            active_asteroids=[civilization],
            active_bonds=[],
        )
    )

    assert result is None
