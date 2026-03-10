from __future__ import annotations

import asyncio
from dataclasses import dataclass
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.auth.service import AuthService


@dataclass
class _AuthSessionStub:
    id: object
    access_expires_at: object
    refresh_expires_at: object


class _SessionStub:
    pass


class _RepositoryStub:
    def __init__(self, *, fail_create_user: bool = False) -> None:
        self.fail_create_user = fail_create_user
        self.create_user_calls = 0
        self.create_galaxy_calls = 0
        self.create_auth_session_calls = 0

    async def get_user_by_email(self, *, session, normalized_email, include_deleted=False):
        return None

    async def create_user(self, *, session, normalized_email, hashed_password):
        self.create_user_calls += 1
        if self.fail_create_user:
            raise HTTPException(status_code=500, detail="create_user_failed")
        return SimpleNamespace(id=uuid4(), is_active=True, hashed_password=hashed_password)

    async def create_galaxy(self, *, session, user_id, name):
        self.create_galaxy_calls += 1
        return SimpleNamespace(id=uuid4(), name=name, owner_id=user_id)

    async def create_auth_session(
        self,
        *,
        session,
        user_id,
        access_expires_at,
        refresh_expires_at,
        user_agent,
        ip_address,
    ):
        self.create_auth_session_calls += 1
        return _AuthSessionStub(id=uuid4(), access_expires_at=access_expires_at, refresh_expires_at=refresh_expires_at)


class _EventStoreStub:
    def __init__(self, *, fail_outbox: bool = False) -> None:
        self.fail_outbox = fail_outbox
        self.append_outbox_calls = 0
        self.last_envelope = None

    async def append_outbox_event(self, *, session, envelope):
        self.append_outbox_calls += 1
        self.last_envelope = envelope
        if self.fail_outbox:
            raise RuntimeError("outbox_append_failed")
        return SimpleNamespace(id=uuid4())


def test_register_business_failure_does_not_append_outbox_event() -> None:
    repository = _RepositoryStub(fail_create_user=True)
    event_store = _EventStoreStub()
    service = AuthService(repository=repository, event_store=event_store)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            service.register(
                session=_SessionStub(),  # type: ignore[arg-type]
                email="pilot@dataverse.local",
                password="safe-pass-123",
            )
        )

    assert exc.value.status_code == 500
    assert repository.create_user_calls == 1
    assert repository.create_galaxy_calls == 0
    assert event_store.append_outbox_calls == 0


def test_register_outbox_failure_bubbles_up_after_business_write_path() -> None:
    repository = _RepositoryStub(fail_create_user=False)
    event_store = _EventStoreStub(fail_outbox=True)
    service = AuthService(repository=repository, event_store=event_store)

    with pytest.raises(RuntimeError, match="outbox_append_failed"):
        asyncio.run(
            service.register(
                session=_SessionStub(),  # type: ignore[arg-type]
                email="pilot@dataverse.local",
                password="safe-pass-123",
            )
        )

    assert repository.create_user_calls == 1
    assert repository.create_galaxy_calls == 1
    assert event_store.append_outbox_calls == 1
    assert event_store.last_envelope is not None
    assert event_store.last_envelope.event_type == "user.created"
