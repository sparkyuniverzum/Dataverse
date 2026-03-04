from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models import OnboardingProgress
from app.schemas import OnboardingAction, OnboardingMetricsPublic, OnboardingMode, OnboardingUpdateRequest
from app.services.onboarding_service import OnboardingService


class _FakeSession:
    async def flush(self) -> None:
        return None

    async def refresh(self, _obj) -> None:
        return None


class _HarnessOnboardingService(OnboardingService):
    def __init__(self, progress: OnboardingProgress, metrics: OnboardingMetricsPublic) -> None:
        super().__init__()
        self.progress = progress
        self.metrics = metrics

    async def ensure_progress(self, *, session, user_id, galaxy_id):  # type: ignore[override]
        return self.progress

    async def read_metrics(self, *, session, user_id, galaxy_id):  # type: ignore[override]
        return self.metrics


def _progress(*, stage_key: str = "galaxy_bootstrap", mode: str = "guided") -> OnboardingProgress:
    now = datetime.now(timezone.utc)
    return OnboardingProgress(
        user_id=uuid4(),
        galaxy_id=uuid4(),
        mode=mode,
        stage_key=stage_key,
        started_at=now,
        stage_started_at=now,
        completed_at=None,
        notes={},
        updated_at=now,
    )


def test_build_public_reports_blockers_and_capabilities() -> None:
    service = OnboardingService()
    progress = _progress(stage_key="planet_workbench")
    metrics = OnboardingMetricsPublic(
        planets_count=1,
        moons_count=1,
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )

    public = service.build_public(progress=progress, metrics=metrics)

    assert public.current_stage_key == "planet_workbench"
    assert public.current_stage_order == 2
    assert public.can_advance is False
    assert public.capabilities == ["quick_create", "parser_commands", "table_grid", "preset_seed", "bonds"]
    assert any("Vazby" in blocker for blocker in public.advance_blockers)


def test_update_public_rejects_hardcore_mode_before_final_stage() -> None:
    progress = _progress(stage_key="guided_flow")
    metrics = OnboardingMetricsPublic(
        planets_count=2,
        moons_count=5,
        bonds_count=2,
        formula_fields_count=1,
        guardian_rules_count=1,
    )
    service = _HarnessOnboardingService(progress, metrics)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            service.update_public(
                session=_FakeSession(),  # type: ignore[arg-type]
                user_id=progress.user_id,
                galaxy_id=progress.galaxy_id,
                payload=OnboardingUpdateRequest(action=OnboardingAction.set_mode, mode=OnboardingMode.hardcore),
            )
        )

    assert exc.value.status_code == 409
    assert "Hardcore mode" in str(exc.value.detail)


def test_update_public_advances_when_requirements_are_met() -> None:
    progress = _progress(stage_key="guided_flow")
    metrics = OnboardingMetricsPublic(
        planets_count=2,
        moons_count=5,
        bonds_count=2,
        formula_fields_count=1,
        guardian_rules_count=1,
    )
    service = _HarnessOnboardingService(progress, metrics)

    public = asyncio.run(
        service.update_public(
            session=_FakeSession(),  # type: ignore[arg-type]
            user_id=progress.user_id,
            galaxy_id=progress.galaxy_id,
            payload=OnboardingUpdateRequest(action=OnboardingAction.advance),
        )
    )

    assert public.current_stage_key == "lawful_ops"
    assert public.current_stage_order == 4
    assert public.can_advance is True


def test_update_public_blocks_stage_one_advance_until_machine_complete() -> None:
    progress = _progress(stage_key="galaxy_bootstrap")
    progress.notes = {"machine": {"step": "calculations", "intro_ack": True, "planet_dropped": True, "schema_confirmed": True}}
    metrics = OnboardingMetricsPublic(
        planets_count=2,
        moons_count=8,
        bonds_count=3,
        formula_fields_count=2,
        guardian_rules_count=1,
    )
    service = _HarnessOnboardingService(progress, metrics)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            service.update_public(
                session=_FakeSession(),  # type: ignore[arg-type]
                user_id=progress.user_id,
                galaxy_id=progress.galaxy_id,
                payload=OnboardingUpdateRequest(action=OnboardingAction.advance),
            )
        )

    assert exc.value.status_code == 409
    assert "immersive Stage 1" in str(exc.value.detail)


def test_update_public_syncs_machine_state() -> None:
    progress = _progress(stage_key="galaxy_bootstrap")
    metrics = OnboardingMetricsPublic(
        planets_count=1,
        moons_count=1,
        bonds_count=0,
        formula_fields_count=0,
        guardian_rules_count=0,
    )
    service = _HarnessOnboardingService(progress, metrics)

    public = asyncio.run(
        service.update_public(
            session=_FakeSession(),  # type: ignore[arg-type]
            user_id=progress.user_id,
            galaxy_id=progress.galaxy_id,
            payload=OnboardingUpdateRequest(
                action=OnboardingAction.sync_machine,
                machine={
                    "intro_ack": True,
                    "planet_dropped": True,
                    "schema_confirmed": True,
                    "dependencies_confirmed": True,
                    "calculations_confirmed": True,
                    "simulation_confirmed": True,
                    "step": "complete",
                },
            ),
        )
    )

    assert public.machine.step == "complete"
    assert public.machine.completed is True
    assert public.can_advance is True
