from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import table_contract_to_public
from app.api.runtime import (
    get_service_container,
    resolve_galaxy_id_for_user,
    resolve_scope_for_user,
    run_scoped_idempotent,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.models import TableContract, User
from app.modules.auth.dependencies import get_current_user
from app.schemas import (
    PresetApplyMode,
    PresetBundleApplyPlanetResultPublic,
    PresetBundleApplyRequest,
    PresetBundleApplyResponse,
    PresetBundleExecutionPublic,
    PresetBundleGraphPlanPublic,
    PresetBundleSummaryPublic,
    PresetCatalogArchetypePublic,
    PresetCatalogItemPublic,
    PresetCatalogResponse,
    SchemaPresetApplyDiffPublic,
    SchemaPresetContractPreviewPublic,
    SchemaPresetSeedPlanPublic,
)
from app.services.task_executor_service import TaskExecutionResult

router = APIRouter(tags=["presets"])


@router.get("/presets/catalog", response_model=PresetCatalogResponse, status_code=status.HTTP_200_OK)
async def presets_catalog(
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PresetCatalogResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    onboarding = await services.onboarding_service.get_public(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
    )
    current_stage = int(onboarding.current_stage_order or 1)

    bundles = services.preset_bundle_service.list_bundles()
    groups: dict[str, list[PresetCatalogItemPublic]] = {
        "catalog": [],
        "stream": [],
        "junction": [],
    }
    for bundle in bundles:
        archetype = str(getattr(bundle, "archetype", "") or "").strip().lower()
        if archetype not in groups:
            continue
        locked_by_stage = int(getattr(bundle, "locked_by_stage", 1) or 1)
        is_unlocked = current_stage >= locked_by_stage
        lock_reason = None
        if not is_unlocked:
            lock_reason = f"Odemkne se od Stage {locked_by_stage}. Aktualne Stage {current_stage}."
        groups[archetype].append(
            PresetCatalogItemPublic(
                key=bundle.key,
                name=bundle.name,
                description=bundle.description,
                tags=[str(item) for item in bundle.tags],
                archetype=archetype,
                difficulty=str(getattr(bundle, "difficulty", "standard") or "standard"),
                seedable=bool(getattr(bundle, "seedable", True)),
                locked_by_stage=locked_by_stage,
                starter=bool(getattr(bundle, "starter", False)),
                is_unlocked=is_unlocked,
                lock_reason=lock_reason,
                bundle_key=bundle.key,
            )
        )

    archetype_meta = {
        "catalog": (
            "Katalog (Staticka civilizace)",
            "Dlouhodobe entity se stabilni identitou, kde se meni hlavne vlastnosti.",
        ),
        "stream": (
            "Datovy proud (Transakcni civilizace)",
            "Prubezne udalosti a transakce zapisovane do historie jako tok v case.",
        ),
        "junction": (
            "Rozcestnik (Spojovaci civilizace)",
            "Mosty mezi civilizacemi pro alokace, mapovani a many-to-many vazby.",
        ),
    }
    ordered: list[PresetCatalogArchetypePublic] = []
    for key in ("catalog", "stream", "junction"):
        title, description = archetype_meta[key]
        presets = sorted(
            groups[key],
            key=lambda item: (
                not item.starter,
                item.locked_by_stage,
                item.name.lower(),
            ),
        )
        ordered.append(
            PresetCatalogArchetypePublic(
                archetype=key,
                title=title,
                description=description,
                presets=presets,
            )
        )
    return PresetCatalogResponse(archetypes=ordered)


@router.post("/presets/apply", response_model=PresetBundleApplyResponse, status_code=status.HTTP_200_OK)
async def apply_preset_bundle(
    payload: PresetBundleApplyRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> PresetBundleApplyResponse:
    resolved_scope = await resolve_scope_for_user(
        session=session,
        user=current_user,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        services=services,
    )
    resolved_galaxy_id, resolved_branch_id = resolved_scope

    async def build_plan_for_scope(target_galaxy_id: UUID, target_branch_id: UUID | None):
        return await services.preset_bundle_service.build_apply_plan(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            bundle_key=payload.bundle_key,
            manifest=payload.manifest,
            conflict_strategy=payload.conflict_strategy.value,
            seed_rows=bool(payload.seed_rows),
            target_planet_id=payload.planet_id,
        )

    def render_response(
        *,
        plan: Any,
        contracts: dict[str, TableContract] | None = None,
        created_refs: dict[str, UUID] | None = None,
        execution: TaskExecutionResult | None = None,
        executed_task_count: int = 0,
    ) -> PresetBundleApplyResponse:
        contracts_map = contracts or {}
        refs = created_refs or {}
        planet_rows: list[PresetBundleApplyPlanetResultPublic] = []
        for planet_plan in plan.planets:
            schema_plan = planet_plan.schema_plan
            if schema_plan is None:
                diff_payload = SchemaPresetApplyDiffPublic()
                contract_preview = SchemaPresetContractPreviewPublic()
                seed_plan = SchemaPresetSeedPlanPublic(
                    requested_rows=0,
                    skipped_existing_rows=0,
                    rows_to_create=0,
                    skipped_values=[],
                )
            else:
                requested_rows = len(schema_plan.preset.default_rows) if payload.seed_rows else 0
                diff_payload = SchemaPresetApplyDiffPublic(**schema_plan.contract_diff)
                contract_preview = SchemaPresetContractPreviewPublic(**schema_plan.merged_contract)
                seed_plan = SchemaPresetSeedPlanPublic(
                    requested_rows=requested_rows,
                    skipped_existing_rows=len(schema_plan.skipped_seed_values),
                    rows_to_create=len(schema_plan.seed_rows_to_create),
                    skipped_values=schema_plan.skipped_seed_values,
                )
            contract = contracts_map.get(planet_plan.planet.key)
            planet_rows.append(
                PresetBundleApplyPlanetResultPublic(
                    planet_key=planet_plan.planet.key,
                    table_id=planet_plan.table_id,
                    table_name=planet_plan.table_name,
                    schema_preset_key=planet_plan.planet.schema_preset_key,
                    diff=diff_payload,
                    contract_preview=contract_preview,
                    seed_plan=seed_plan,
                    contract=table_contract_to_public(contract) if contract is not None else None,
                )
            )

        graph_plan = PresetBundleGraphPlanPublic(
            moons_requested=len(plan.manifest.moons),
            moons_to_create=len([moon for moon in plan.moons if not moon.skip_existing]),
            bonds_requested=len(plan.manifest.bonds),
            formulas_requested=len(plan.manifest.formulas),
            guardians_requested=len(plan.manifest.guardians),
        )

        execution_summary: PresetBundleExecutionPublic | None = None
        if execution is not None:
            touched_moons = len({item.id for item in execution.civilizations})
            execution_summary = PresetBundleExecutionPublic(
                task_count=executed_task_count,
                touched_moons=touched_moons,
                touched_bonds=len(execution.bonds),
                semantic_effects_count=len(execution.semantic_effects),
            )

        return PresetBundleApplyResponse(
            mode=payload.mode,
            bundle=PresetBundleSummaryPublic(
                key=plan.bundle_key,
                version=plan.bundle_version,
                name=plan.bundle_name,
                description=plan.bundle_description,
                tags=[str(item) for item in plan.bundle_tags],
                planets_count=len(plan.manifest.planets),
                moons_count=len(plan.manifest.moons),
                bonds_count=len(plan.manifest.bonds),
                formulas_count=len(plan.manifest.formulas),
                guardians_count=len(plan.manifest.guardians),
            ),
            planets=planet_rows,
            graph_plan=graph_plan,
            created_refs=refs,
            execution=execution_summary,
            warnings=plan.warnings,
        )

    if payload.mode == PresetApplyMode.preview:
        preview_plan = await build_plan_for_scope(resolved_galaxy_id, resolved_branch_id)
        return render_response(plan=preview_plan)

    async def execute_scoped(target_galaxy_id: UUID, target_branch_id: UUID | None) -> PresetBundleApplyResponse:
        commit_plan = await build_plan_for_scope(target_galaxy_id, target_branch_id)
        if payload.planet_id is None and len(commit_plan.planets) == 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="planet_id is required for single-planet preset commit.",
            )
        commit_result = await services.preset_bundle_service.apply_plan_commit(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            plan=commit_plan,
        )
        return render_response(
            plan=commit_plan,
            contracts=commit_result.planet_contracts,
            created_refs=commit_result.created_refs,
            execution=commit_result.execution,
            executed_task_count=commit_result.executed_task_count,
        )

    return await run_scoped_idempotent(
        session=session,
        current_user=current_user,
        services=services,
        galaxy_id=payload.galaxy_id,
        branch_id=payload.branch_id,
        endpoint_key="POST:/presets/apply",
        idempotency_key=payload.idempotency_key,
        request_payload={
            "bundle_key": payload.bundle_key,
            "manifest": payload.manifest,
            "mode": payload.mode.value,
            "conflict_strategy": payload.conflict_strategy.value,
            "seed_rows": bool(payload.seed_rows),
        },
        execute=execute_scoped,
        replay_loader=PresetBundleApplyResponse.model_validate,
        response_dumper=lambda response: response.model_dump(mode="json"),
        empty_response_detail="Preset bundle apply failed",
        resolved_scope=resolved_scope,
    )
