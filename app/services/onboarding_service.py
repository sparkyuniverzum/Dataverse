from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GalaxyHealthRM, GalaxySummaryRM, OnboardingProgress
from app.schemas import (
    OnboardingAction,
    OnboardingMachinePublic,
    OnboardingMachineUpdate,
    OnboardingMetricsPublic,
    OnboardingMode,
    OnboardingPublic,
    OnboardingStagePublic,
    OnboardingUpdateRequest,
)


@dataclass(frozen=True)
class StageDefinition:
    key: str
    title: str
    description: str
    target_days: int
    requirements: dict[str, int]
    unlocked_features: tuple[str, ...]


METRIC_LABELS = {
    "planets_count": "Planety",
    "moons_count": "Mesice",
    "bonds_count": "Vazby",
    "formula_fields_count": "Formula pole",
    "guardian_rules_count": "Guardian pravidla",
}

MACHINE_STEPS: tuple[str, ...] = (
    "intro",
    "blueprint",
    "drop_planet",
    "schema",
    "dependencies",
    "calculations",
    "simulation",
    "complete",
)


STAGES: tuple[StageDefinition, ...] = (
    StageDefinition(
        key="galaxy_bootstrap",
        title="Stage 1: Seznameni",
        description="Vyber workspace a zaloz prvni planetu s prvnim mesicem.",
        target_days=7,
        requirements={},
        unlocked_features=("quick_create", "parser_commands", "table_grid", "preset_seed"),
    ),
    StageDefinition(
        key="planet_workbench",
        title="Stage 2: Planet Sandbox",
        description="Prace v jedne planete, editace mesicu a prvni vazby.",
        target_days=21,
        requirements={"planets_count": 1, "moons_count": 1},
        unlocked_features=("bonds",),
    ),
    StageDefinition(
        key="guided_flow",
        title="Stage 3: Rizeny Tok",
        description="Pridani vice mesicu, vazeb a prvni datove toky.",
        target_days=30,
        requirements={"moons_count": 3, "bonds_count": 1},
        unlocked_features=("formulas", "guardians", "imports"),
    ),
    StageDefinition(
        key="lawful_ops",
        title="Stage 4: Zakony Modelu",
        description="Zavedeni formule a guardianu, ovladnuti modelovych zakonu.",
        target_days=45,
        requirements={"formula_fields_count": 1, "guardian_rules_count": 1},
        unlocked_features=("branches", "contracts"),
    ),
    StageDefinition(
        key="hardcore_editor",
        title="Stage 5: Hardcore Editor",
        description="Plny editor bez voditek, vsechny nastroje jsou odemcene.",
        target_days=0,
        requirements={"planets_count": 2, "moons_count": 5, "bonds_count": 2},
        unlocked_features=("hardcore_editor",),
    ),
)


class OnboardingService:
    @staticmethod
    def _default_machine_state() -> dict[str, bool | str]:
        return {
            "step": "intro",
            "intro_ack": False,
            "planet_dropped": False,
            "schema_confirmed": False,
            "dependencies_confirmed": False,
            "calculations_confirmed": False,
            "simulation_confirmed": False,
            "completed": False,
        }

    def _step_index(self, step: str) -> int:
        value = str(step or "").strip()
        if value in MACHINE_STEPS:
            return MACHINE_STEPS.index(value)
        return 0

    def _normalize_machine_state(self, raw: dict[str, object] | None) -> dict[str, bool | str]:
        baseline = self._default_machine_state()
        if isinstance(raw, dict):
            for key in baseline:
                if key == "step":
                    continue
                if key in raw:
                    baseline[key] = bool(raw.get(key))
            raw_step = str(raw.get("step") or "").strip()
            baseline["step"] = raw_step if raw_step in MACHINE_STEPS else "intro"

        if baseline["completed"]:
            baseline["step"] = "complete"
        if baseline["simulation_confirmed"] and self._step_index(str(baseline["step"])) < self._step_index("complete"):
            baseline["step"] = "complete"
        if baseline["calculations_confirmed"] and self._step_index(str(baseline["step"])) < self._step_index(
            "simulation"
        ):
            baseline["step"] = "simulation"
        if baseline["dependencies_confirmed"] and self._step_index(str(baseline["step"])) < self._step_index(
            "calculations"
        ):
            baseline["step"] = "calculations"
        if baseline["schema_confirmed"] and self._step_index(str(baseline["step"])) < self._step_index("dependencies"):
            baseline["step"] = "dependencies"
        if baseline["planet_dropped"] and self._step_index(str(baseline["step"])) < self._step_index("schema"):
            baseline["step"] = "schema"
        if baseline["intro_ack"] and self._step_index(str(baseline["step"])) < self._step_index("blueprint"):
            baseline["step"] = "blueprint"
        if str(baseline["step"]) == "complete":
            baseline["completed"] = True
            baseline["simulation_confirmed"] = True
        return baseline

    def _machine_state_from_progress(self, progress: OnboardingProgress) -> dict[str, bool | str]:
        notes = progress.notes if isinstance(progress.notes, dict) else {}
        raw_machine = notes.get("machine") if isinstance(notes.get("machine"), dict) else {}
        return self._normalize_machine_state(raw_machine)

    def _set_machine_state_on_progress(self, *, progress: OnboardingProgress, machine: dict[str, bool | str]) -> None:
        notes = progress.notes if isinstance(progress.notes, dict) else {}
        normalized_notes = dict(notes)
        normalized_notes["machine"] = self._normalize_machine_state(machine)
        progress.notes = normalized_notes

    def _apply_machine_patch(
        self,
        *,
        current: dict[str, bool | str],
        patch: OnboardingMachineUpdate,
    ) -> dict[str, bool | str]:
        payload = patch.model_dump(exclude_none=True)
        merged = dict(current)
        for key, value in payload.items():
            if key == "step":
                candidate = str(value or "").strip()
                if candidate in MACHINE_STEPS and self._step_index(candidate) >= self._step_index(str(merged["step"])):
                    merged["step"] = candidate
                continue
            if key in merged:
                merged[key] = bool(value)
        return self._normalize_machine_state(merged)

    def _stage_index(self, stage_key: str) -> int:
        for idx, stage in enumerate(STAGES):
            if stage.key == stage_key:
                return idx
        return 0

    def _stage_by_index(self, index: int) -> StageDefinition:
        bounded = max(0, min(index, len(STAGES) - 1))
        return STAGES[bounded]

    def _normalize_mode(self, raw_mode: str) -> OnboardingMode:
        try:
            return OnboardingMode(str(raw_mode or OnboardingMode.guided.value))
        except ValueError:
            return OnboardingMode.guided

    def _missing_requirements(self, metrics: OnboardingMetricsPublic, requirements: dict[str, int]) -> dict[str, int]:
        missing: dict[str, int] = {}
        for metric_key, required in requirements.items():
            value = int(getattr(metrics, metric_key, 0) or 0)
            required_value = int(required or 0)
            if value < required_value:
                missing[metric_key] = required_value - value
        return missing

    def _describe_blockers(self, missing: dict[str, int], requirements: dict[str, int]) -> list[str]:
        blockers: list[str] = []
        for metric_key, gap in missing.items():
            required = int(requirements.get(metric_key, 0) or 0)
            label = METRIC_LABELS.get(metric_key, metric_key)
            blockers.append(f"{label}: chybi {gap} (cil {required})")
        return blockers

    def _capabilities_for_stage(self, stage_index: int) -> list[str]:
        capabilities: list[str] = []
        seen: set[str] = set()
        for idx in range(0, stage_index + 1):
            for capability in self._stage_by_index(idx).unlocked_features:
                if capability in seen:
                    continue
                seen.add(capability)
                capabilities.append(capability)
        return capabilities

    async def ensure_progress(self, *, session: AsyncSession, user_id: UUID, galaxy_id: UUID) -> OnboardingProgress:
        progress = await session.get(
            OnboardingProgress,
            {"user_id": user_id, "galaxy_id": galaxy_id},
        )
        if progress is not None:
            machine = self._machine_state_from_progress(progress)
            self._set_machine_state_on_progress(progress=progress, machine=machine)
            if self._stage_index(progress.stage_key) == 0 and progress.stage_key != STAGES[0].key:
                progress.stage_key = STAGES[0].key
                progress.updated_at = datetime.now(timezone.utc)
            return progress

        now = datetime.now(timezone.utc)
        progress = OnboardingProgress(
            user_id=user_id,
            galaxy_id=galaxy_id,
            mode=OnboardingMode.guided.value,
            stage_key=STAGES[0].key,
            started_at=now,
            stage_started_at=now,
            updated_at=now,
            notes={"machine": self._default_machine_state()},
        )
        session.add(progress)
        await session.flush()
        await session.refresh(progress)
        return progress

    async def read_metrics(self, *, session: AsyncSession, user_id: UUID, galaxy_id: UUID) -> OnboardingMetricsPublic:
        summary = (
            await session.execute(
                select(GalaxySummaryRM).where(
                    GalaxySummaryRM.user_id == user_id,
                    GalaxySummaryRM.galaxy_id == galaxy_id,
                )
            )
        ).scalar_one_or_none()
        health = (
            await session.execute(
                select(GalaxyHealthRM).where(
                    GalaxyHealthRM.user_id == user_id,
                    GalaxyHealthRM.galaxy_id == galaxy_id,
                )
            )
        ).scalar_one_or_none()
        return OnboardingMetricsPublic(
            planets_count=int(getattr(summary, "planets_count", 0) or 0),
            moons_count=int(getattr(summary, "moons_count", 0) or 0),
            bonds_count=int(getattr(summary, "bonds_count", 0) or 0),
            formula_fields_count=int(getattr(summary, "formula_fields_count", 0) or 0),
            guardian_rules_count=int(getattr(health, "guardian_rules_count", 0) or 0),
        )

    def build_public(self, *, progress: OnboardingProgress, metrics: OnboardingMetricsPublic) -> OnboardingPublic:
        stage_index = self._stage_index(progress.stage_key)
        current_stage = self._stage_by_index(stage_index)
        stage_rows: list[OnboardingStagePublic] = []
        machine_state = self._machine_state_from_progress(progress)

        for idx, stage in enumerate(STAGES):
            missing = self._missing_requirements(metrics, stage.requirements)
            status_label = "locked"
            if idx < stage_index:
                status_label = "completed"
            elif idx == stage_index:
                status_label = "active"
            stage_rows.append(
                OnboardingStagePublic(
                    key=stage.key,
                    title=stage.title,
                    description=stage.description,
                    order=idx + 1,
                    target_days=stage.target_days,
                    requirements=stage.requirements,
                    missing_requirements=missing,
                    unlocked_features=list(stage.unlocked_features),
                    status=status_label,
                )
            )

        can_advance = False
        advance_blockers: list[str] = []
        if stage_index < len(STAGES) - 1:
            next_stage = self._stage_by_index(stage_index + 1)
            missing_for_next = self._missing_requirements(metrics, next_stage.requirements)
            can_advance = not missing_for_next
            advance_blockers = self._describe_blockers(missing_for_next, next_stage.requirements)
            if current_stage.key == STAGES[0].key and machine_state["step"] != "complete":
                can_advance = False
                advance_blockers = [
                    "Dokonci Stage 1 flow (Blueprint -> Drop -> Schema -> Vazby -> Vypocty -> Simulace)."
                ]

        return OnboardingPublic(
            user_id=progress.user_id,
            galaxy_id=progress.galaxy_id,
            mode=self._normalize_mode(progress.mode),
            current_stage_key=current_stage.key,
            current_stage_order=stage_index + 1,
            started_at=progress.started_at,
            stage_started_at=progress.stage_started_at,
            completed_at=progress.completed_at,
            updated_at=progress.updated_at,
            can_advance=can_advance,
            advance_blockers=advance_blockers,
            capabilities=self._capabilities_for_stage(stage_index),
            machine=OnboardingMachinePublic.model_validate(machine_state),
            metrics=metrics,
            stages=stage_rows,
        )

    async def get_public(self, *, session: AsyncSession, user_id: UUID, galaxy_id: UUID) -> OnboardingPublic:
        progress = await self.ensure_progress(session=session, user_id=user_id, galaxy_id=galaxy_id)
        metrics = await self.read_metrics(session=session, user_id=user_id, galaxy_id=galaxy_id)
        return self.build_public(progress=progress, metrics=metrics)

    async def update_public(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        payload: OnboardingUpdateRequest,
    ) -> OnboardingPublic:
        progress = await self.ensure_progress(session=session, user_id=user_id, galaxy_id=galaxy_id)
        metrics = await self.read_metrics(session=session, user_id=user_id, galaxy_id=galaxy_id)
        stage_index = self._stage_index(progress.stage_key)
        now = datetime.now(timezone.utc)

        if payload.action == OnboardingAction.reset:
            progress.mode = OnboardingMode.guided.value
            progress.stage_key = STAGES[0].key
            progress.stage_started_at = now
            progress.completed_at = None
            self._set_machine_state_on_progress(progress=progress, machine=self._default_machine_state())
            progress.updated_at = now
        elif payload.action == OnboardingAction.sync_machine:
            if payload.machine is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="machine payload is required"
                )
            current_machine = self._machine_state_from_progress(progress)
            next_machine = self._apply_machine_patch(current=current_machine, patch=payload.machine)
            self._set_machine_state_on_progress(progress=progress, machine=next_machine)
            progress.updated_at = now
        elif payload.action == OnboardingAction.set_mode:
            target_mode = payload.mode or OnboardingMode.guided
            if target_mode == OnboardingMode.template and stage_index < 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Template mode unlocks from Stage 2.",
                )
            if target_mode == OnboardingMode.hardcore and progress.stage_key != STAGES[-1].key:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Hardcore mode unlocks in the final stage.",
                )
            progress.mode = target_mode.value
            progress.updated_at = now
        else:
            current_machine = self._machine_state_from_progress(progress)
            if stage_index == 0 and current_machine["step"] != "complete":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "ONBOARDING_STAGE_BLOCKED",
                        "stage": STAGES[0].key,
                        "missing_requirements": {"machine_step": "complete"},
                        "message": "Finish the immersive Stage 1 flow before advancing.",
                    },
                )
            if stage_index < len(STAGES) - 1:
                next_stage = self._stage_by_index(stage_index + 1)
                missing = self._missing_requirements(metrics, next_stage.requirements)
                if missing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "code": "ONBOARDING_STAGE_BLOCKED",
                            "stage": next_stage.key,
                            "missing_requirements": missing,
                            "message": "Onboarding stage requirements are not met yet.",
                        },
                    )
                progress.stage_key = next_stage.key
                progress.stage_started_at = now
                progress.updated_at = now
                if next_stage.key == STAGES[-1].key:
                    progress.completed_at = now

        await session.flush()
        await session.refresh(progress)
        metrics_after = await self.read_metrics(session=session, user_id=user_id, galaxy_id=galaxy_id)
        return self.build_public(progress=progress, metrics=metrics_after)
