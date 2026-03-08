import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.runtime import ensure_onboarding_progress_safe


class _NestedTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _SessionStub:
    def begin_nested(self):
        return _NestedTransaction()


def test_ensure_onboarding_progress_safe_calls_service() -> None:
    session = _SessionStub()
    onboarding_service = SimpleNamespace(ensure_progress=AsyncMock(return_value=None))
    services = SimpleNamespace(onboarding_service=onboarding_service)

    asyncio.run(
        ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=uuid4(),
            galaxy_id=uuid4(),
            context="test.runtime",
        )
    )

    assert onboarding_service.ensure_progress.await_count == 1


def test_ensure_onboarding_progress_safe_swallows_sqlalchemy_error() -> None:
    session = _SessionStub()
    onboarding_service = SimpleNamespace(ensure_progress=AsyncMock(side_effect=SQLAlchemyError("db failure")))
    services = SimpleNamespace(onboarding_service=onboarding_service)

    asyncio.run(
        ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=uuid4(),
            galaxy_id=uuid4(),
            context="test.runtime.error",
        )
    )

    assert onboarding_service.ensure_progress.await_count == 1
