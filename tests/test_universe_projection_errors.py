from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

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
                payload={"source_id": "not-a-uuid", "target_id": str(uuid4()), "type": "RELATION"},
                timestamp=datetime.now(timezone.utc),
                event_seq=1,
            )
        ]


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
