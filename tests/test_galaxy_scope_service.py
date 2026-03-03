from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import Galaxy
from app.services.galaxy_scope_service import resolve_user_galaxy_for_user


class _FakeScalars:
    def __init__(self, first_value):
        self._first_value = first_value

    def first(self):
        return self._first_value


class _FakeExecuteResult:
    def __init__(self, *, first_value=None, scalar_value=None):
        self._first_value = first_value
        self._scalar_value = scalar_value

    def scalars(self):
        return _FakeScalars(self._first_value)

    def scalar_one_or_none(self):
        return self._scalar_value


class _FakeSession:
    def __init__(self, responses):
        self._responses = list(responses)

    async def execute(self, _stmt):
        if not self._responses:
            raise AssertionError("No fake response configured for execute()")
        return self._responses.pop(0)


def _galaxy(*, owner_id):
    return Galaxy(
        id=uuid4(),
        name="Test Galaxy",
        owner_id=owner_id,
        created_at=datetime.now(timezone.utc),
    )


def test_resolve_user_galaxy_returns_first_active_when_id_missing() -> None:
    user_id = uuid4()
    galaxy = _galaxy(owner_id=user_id)
    session = _FakeSession([_FakeExecuteResult(first_value=galaxy)])

    resolved = asyncio.run(
        resolve_user_galaxy_for_user(
            session=session,  # type: ignore[arg-type]
            user_id=user_id,
            galaxy_id=None,
        )
    )

    assert resolved.id == galaxy.id


def test_resolve_user_galaxy_raises_404_when_no_active_exists() -> None:
    session = _FakeSession([_FakeExecuteResult(first_value=None)])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_user_galaxy_for_user(
                session=session,  # type: ignore[arg-type]
                user_id=uuid4(),
                galaxy_id=None,
            )
        )

    assert exc.value.status_code == 404
    assert "No active galaxy" in str(exc.value.detail)


def test_resolve_user_galaxy_raises_404_when_specific_missing() -> None:
    session = _FakeSession([_FakeExecuteResult(scalar_value=None)])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_user_galaxy_for_user(
                session=session,  # type: ignore[arg-type]
                user_id=uuid4(),
                galaxy_id=uuid4(),
            )
        )

    assert exc.value.status_code == 404
    assert "Galaxy not found" in str(exc.value.detail)


def test_resolve_user_galaxy_raises_403_for_foreign_owner() -> None:
    owner_id = uuid4()
    user_id = uuid4()
    foreign = _galaxy(owner_id=owner_id)
    session = _FakeSession([_FakeExecuteResult(scalar_value=foreign)])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_user_galaxy_for_user(
                session=session,  # type: ignore[arg-type]
                user_id=user_id,
                galaxy_id=foreign.id,
            )
        )

    assert exc.value.status_code == 403
    assert "Forbidden galaxy access" in str(exc.value.detail)
