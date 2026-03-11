from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infrastructure.runtime.parser.command_service import resolve_tasks_for_payload
from app.schema_models.execution import ParseCommandRequest
from app.services.parser_types import AtomicTask


@dataclass
class _ParseResult:
    tasks: list[AtomicTask]
    errors: list[str]


@dataclass
class _ParserServiceStub:
    result: _ParseResult
    calls: int = 0

    def parse_with_diagnostics(self, _command: str) -> _ParseResult:
        self.calls += 1
        return self.result


class _UniverseServiceStub:
    async def project_state(self, **_kwargs):  # noqa: ANN003
        return [], []


async def _ensure_scope():
    return uuid4(), None


def _services(*, parser_service: _ParserServiceStub) -> SimpleNamespace:
    return SimpleNamespace(
        parser_service=parser_service,
        parser2_planner=object(),  # Missing `.parser` -> deterministic v2 runtime failure.
        universe_service=_UniverseServiceStub(),
        parser2_executor_bridge=object(),
    )


def test_resolve_tasks_falls_back_to_v1_when_v2_runtime_fails_and_policy_allows(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "true")
    parser_service = _ParserServiceStub(
        result=_ParseResult(
            tasks=[AtomicTask(action="INGEST", params={"value": "fallback", "metadata": {}})],
            errors=[],
        )
    )
    payload = ParseCommandRequest(text="fallback command")
    caplog.set_level(logging.WARNING, logger="app.infrastructure.runtime.parser.command_service")

    tasks = asyncio.run(
        resolve_tasks_for_payload(
            payload=payload,
            session=object(),  # type: ignore[arg-type]
            current_user_id=uuid4(),
            services=_services(parser_service=parser_service),
            ensure_scope=_ensure_scope,
        )
    )

    assert len(tasks) == 1
    assert tasks[0].action == "INGEST"
    assert parser_service.calls == 1
    fallback_logs = [record for record in caplog.records if record.message == "parser.v2.fallback_to_v1"]
    assert fallback_logs
    assert getattr(fallback_logs[0], "fallback_policy_mode", None) == "auto_unpinned"
    assert getattr(fallback_logs[0], "fallback_policy_reason", None) == "policy_auto_unpinned_allowed"


def test_resolve_tasks_falls_back_to_v1_when_policy_mode_is_always_even_for_explicit_v2(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_POLICY", "always")
    parser_service = _ParserServiceStub(
        result=_ParseResult(
            tasks=[AtomicTask(action="INGEST", params={"value": "always-fallback", "metadata": {}})],
            errors=[],
        )
    )
    payload = ParseCommandRequest(text="always policy fallback", parser_version="v2")

    tasks = asyncio.run(
        resolve_tasks_for_payload(
            payload=payload,
            session=object(),  # type: ignore[arg-type]
            current_user_id=uuid4(),
            services=_services(parser_service=parser_service),
            ensure_scope=_ensure_scope,
        )
    )

    assert len(tasks) == 1
    assert tasks[0].action == "INGEST"
    assert parser_service.calls == 1


def test_resolve_tasks_rejects_v2_runtime_failure_when_version_is_explicit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "true")
    parser_service = _ParserServiceStub(result=_ParseResult(tasks=[], errors=[]))
    payload = ParseCommandRequest(text="strict command", parser_version="v2")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_tasks_for_payload(
                payload=payload,
                session=object(),  # type: ignore[arg-type]
                current_user_id=uuid4(),
                services=_services(parser_service=parser_service),
                ensure_scope=_ensure_scope,
            )
        )

    assert exc.value.status_code == 422
    assert "parser_v2_runtime_failure" in str(exc.value.detail)
    assert parser_service.calls == 0


def test_resolve_tasks_rejects_v2_runtime_failure_when_fallback_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "false")
    parser_service = _ParserServiceStub(result=_ParseResult(tasks=[], errors=[]))
    payload = ParseCommandRequest(text="disabled fallback command")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_tasks_for_payload(
                payload=payload,
                session=object(),  # type: ignore[arg-type]
                current_user_id=uuid4(),
                services=_services(parser_service=parser_service),
                ensure_scope=_ensure_scope,
            )
        )

    assert exc.value.status_code == 422
    assert "parser_v2_runtime_failure" in str(exc.value.detail)
    assert parser_service.calls == 0


def test_resolve_tasks_respects_explicit_disabled_policy_over_legacy_true_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_TO_V1", "true")
    monkeypatch.setenv("DATAVERSE_PARSER_V2_FALLBACK_POLICY", "disabled")
    parser_service = _ParserServiceStub(result=_ParseResult(tasks=[], errors=[]))
    payload = ParseCommandRequest(text="policy disabled command")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            resolve_tasks_for_payload(
                payload=payload,
                session=object(),  # type: ignore[arg-type]
                current_user_id=uuid4(),
                services=_services(parser_service=parser_service),
                ensure_scope=_ensure_scope,
            )
        )

    assert exc.value.status_code == 422
    assert "fallback_policy=disabled" in str(exc.value.detail)
    assert parser_service.calls == 0
