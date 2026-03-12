from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infrastructure.runtime.parser.aliases import (
    resolve_canonical_command,
    resolve_command_alias_for_scope,
    to_runtime_command,
    validate_alias_phrase,
)


@dataclass
class _FakeEvent:
    entity_id: object
    event_type: str
    payload: dict
    galaxy_id: object
    timestamp: datetime


class _FakeScalarResult:
    def __init__(self, events: list[_FakeEvent]) -> None:
        self._events = events

    def scalars(self) -> _FakeScalarResult:
        return self

    def all(self) -> list[_FakeEvent]:
        return self._events


class _FakeSession:
    def __init__(self, events: list[_FakeEvent]) -> None:
        self._events = events

    async def execute(self, _stmt):  # noqa: ANN001
        return _FakeScalarResult(self._events)


def test_resolve_canonical_command_accepts_lexicon_key_and_alias() -> None:
    assert resolve_canonical_command("zhasni") == "zhasni"
    assert resolve_canonical_command("delete").startswith("zhasni")
    assert resolve_canonical_command("vytvor_civilizaci").startswith("vytvor civilizaci")


def test_validate_alias_phrase_blocks_reserved_and_ontology_terms() -> None:
    with pytest.raises(HTTPException) as reserved_exc:
        validate_alias_phrase("civilizace")
    assert reserved_exc.value.status_code == 409
    assert reserved_exc.value.detail.get("reason") == "RESERVED_TERM"

    with pytest.raises(HTTPException) as ontology_exc:
        validate_alias_phrase("mesic")
    assert ontology_exc.value.status_code == 409
    assert ontology_exc.value.detail.get("reason") == "ONTOLOGY_CONFLICT"


def test_to_runtime_command_keeps_canonical_but_adapts_supported_parser_prefix() -> None:
    assert to_runtime_command("vyber: Projekt @ active").startswith("show:")
    assert to_runtime_command("zhasni: Projekt") == "zhasni: Projekt"


def test_resolve_command_alias_prefers_personal_scope_over_workspace() -> None:
    now = datetime.now(UTC)
    galaxy_id = uuid4()
    actor_user_id = uuid4()
    workspace_alias_id = uuid4()
    personal_alias_id = uuid4()

    session = _FakeSession(
        events=[
            _FakeEvent(
                entity_id=workspace_alias_id,
                event_type="ALIAS_REGISTERED",
                galaxy_id=galaxy_id,
                timestamp=now,
                payload={
                    "alias_id": str(workspace_alias_id),
                    "scope_type": "workspace",
                    "galaxy_id": str(galaxy_id),
                    "owner_user_id": None,
                    "alias_phrase": "pulse",
                    "canonical_command": "zhasni",
                    "is_active": True,
                    "version": 1,
                },
            ),
            _FakeEvent(
                entity_id=personal_alias_id,
                event_type="ALIAS_REGISTERED",
                galaxy_id=galaxy_id,
                timestamp=now,
                payload={
                    "alias_id": str(personal_alias_id),
                    "scope_type": "personal",
                    "galaxy_id": str(galaxy_id),
                    "owner_user_id": str(actor_user_id),
                    "alias_phrase": "pulse",
                    "canonical_command": "vyber",
                    "is_active": True,
                    "version": 1,
                },
            ),
        ]
    )

    resolution = asyncio.run(
        resolve_command_alias_for_scope(
            session=session,  # type: ignore[arg-type]
            galaxy_id=galaxy_id,
            current_user_id=actor_user_id,
            command="pulse: Target",
        )
    )
    assert resolution.alias_used is True
    assert resolution.alias_scope_type == "personal"
    assert resolution.alias_id == personal_alias_id
    assert resolution.resolved_command.startswith("vyber")
