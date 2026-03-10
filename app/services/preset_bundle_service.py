from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TableContract
from app.presets.bundle_presets import BundleDefinition, get_preset_bundle, list_preset_bundles
from app.services.parser_types import AtomicTask
from app.services.schema_preset_service import PresetApplyPlan, SchemaPresetService
from app.services.task_executor.models import TaskExecutionResult
from app.services.task_executor.service import TaskExecutorService
from app.services.universe_service import ProjectedAsteroid, UniverseService, derive_table_id, derive_table_name


@dataclass(frozen=True)
class _ManifestPlanet:
    key: str
    table_name: str
    schema_preset_key: str | None


@dataclass(frozen=True)
class _ManifestMoon:
    ref: str
    planet_key: str
    value: Any
    metadata: dict[str, Any]


@dataclass(frozen=True)
class _ManifestBond:
    source_ref: str
    target_ref: str
    bond_type: str


@dataclass(frozen=True)
class _ManifestFormula:
    target_ref: str
    field: str
    formula: str


@dataclass(frozen=True)
class _ManifestGuardian:
    target_ref: str
    field: str
    operator: str
    threshold: Any
    action: str


@dataclass(frozen=True)
class ParsedBundleManifest:
    planets: list[_ManifestPlanet]
    moons: list[_ManifestMoon]
    bonds: list[_ManifestBond]
    formulas: list[_ManifestFormula]
    guardians: list[_ManifestGuardian]


@dataclass
class BundlePlanetPlan:
    planet: _ManifestPlanet
    table_id: UUID
    table_name: str
    schema_plan: PresetApplyPlan | None


@dataclass
class BundleMoonPlan:
    moon: _ManifestMoon
    table_id: UUID
    table_name: str
    metadata: dict[str, Any]
    skip_existing: bool


@dataclass
class BundleApplyPlan:
    bundle_key: str
    bundle_version: int
    bundle_name: str
    bundle_description: str
    bundle_tags: list[str]
    manifest: ParsedBundleManifest
    planets: list[BundlePlanetPlan]
    moons: list[BundleMoonPlan]
    warnings: list[str]


@dataclass
class BundleApplyCommitResult:
    planet_contracts: dict[str, TableContract]
    created_refs: dict[str, UUID]
    execution: TaskExecutionResult | None
    executed_task_count: int


class PresetBundleService:
    def __init__(
        self,
        *,
        schema_preset_service: SchemaPresetService,
        universe_service: UniverseService,
        task_executor_service: TaskExecutorService,
    ) -> None:
        self.schema_preset_service = schema_preset_service
        self.universe_service = universe_service
        self.task_executor_service = task_executor_service

    @staticmethod
    def _normalize_text(value: Any) -> str:
        return str(value or "").strip().casefold()

    @staticmethod
    def _manifest_list(value: Any, field: str) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Bundle manifest field '{field}' must be a list",
            )
        output: list[dict[str, Any]] = []
        for item in value:
            if not isinstance(item, dict):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Bundle manifest field '{field}' must contain objects",
                )
            output.append(item)
        return output

    def _parse_manifest(self, manifest: dict[str, Any]) -> ParsedBundleManifest:
        if not isinstance(manifest, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Bundle manifest must be an object",
            )

        raw_planets = self._manifest_list(manifest.get("planets"), "planets")
        if not raw_planets:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Bundle manifest must define at least one planet",
            )

        planets: list[_ManifestPlanet] = []
        planet_keys: set[str] = set()
        for item in raw_planets:
            key = str(item.get("key") or "").strip()
            table_name = str(item.get("table_name") or "").strip()
            if not key or not table_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Planet manifest requires 'key' and 'table_name'",
                )
            if key in planet_keys:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Duplicate planet key '{key}' in bundle manifest",
                )
            planet_keys.add(key)
            schema_preset_key = str(item.get("schema_preset_key") or "").strip() or None
            planets.append(_ManifestPlanet(key=key, table_name=table_name, schema_preset_key=schema_preset_key))

        raw_moons = self._manifest_list(manifest.get("moons"), "moons")
        moons: list[_ManifestMoon] = []
        moon_refs: set[str] = set()
        for item in raw_moons:
            ref = str(item.get("ref") or "").strip()
            planet_key = str(item.get("planet") or "").strip()
            if not ref or not planet_key:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Moon manifest requires 'ref' and 'planet'",
                )
            if ref in moon_refs:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Duplicate moon ref '{ref}' in bundle manifest",
                )
            if planet_key not in planet_keys:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Moon ref '{ref}' points to unknown planet '{planet_key}'",
                )
            moon_refs.add(ref)
            metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
            moons.append(
                _ManifestMoon(
                    ref=ref,
                    planet_key=planet_key,
                    value=item.get("value"),
                    metadata=dict(metadata),
                )
            )

        raw_bonds = self._manifest_list(manifest.get("bonds"), "bonds")
        bonds: list[_ManifestBond] = []
        for item in raw_bonds:
            source_ref = str(item.get("source_ref") or "").strip()
            target_ref = str(item.get("target_ref") or "").strip()
            if not source_ref or not target_ref:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Bond manifest requires 'source_ref' and 'target_ref'",
                )
            if source_ref not in moon_refs or target_ref not in moon_refs:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Bond '{source_ref}->{target_ref}' references unknown moon refs",
                )
            bond_type = str(item.get("type") or "RELATION").strip().upper() or "RELATION"
            bonds.append(_ManifestBond(source_ref=source_ref, target_ref=target_ref, bond_type=bond_type))

        raw_formulas = self._manifest_list(manifest.get("formulas"), "formulas")
        formulas: list[_ManifestFormula] = []
        for item in raw_formulas:
            target_ref = str(item.get("target_ref") or "").strip()
            field = str(item.get("field") or "").strip()
            formula = str(item.get("formula") or "").strip()
            if not target_ref or not field or not formula:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Formula manifest requires 'target_ref', 'field', 'formula'",
                )
            if target_ref not in moon_refs:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Formula target_ref '{target_ref}' is unknown",
                )
            formulas.append(_ManifestFormula(target_ref=target_ref, field=field, formula=formula))

        raw_guardians = self._manifest_list(manifest.get("guardians"), "guardians")
        guardians: list[_ManifestGuardian] = []
        for item in raw_guardians:
            target_ref = str(item.get("target_ref") or "").strip()
            field = str(item.get("field") or "").strip()
            operator = str(item.get("operator") or "").strip()
            action = str(item.get("action") or "").strip()
            if not target_ref or not field or not operator or not action:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Guardian manifest requires 'target_ref', 'field', 'operator', 'action'",
                )
            if target_ref not in moon_refs:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Guardian target_ref '{target_ref}' is unknown",
                )
            guardians.append(
                _ManifestGuardian(
                    target_ref=target_ref,
                    field=field,
                    operator=operator,
                    threshold=item.get("threshold"),
                    action=action,
                )
            )

        return ParsedBundleManifest(
            planets=planets,
            moons=moons,
            bonds=bonds,
            formulas=formulas,
            guardians=guardians,
        )

    async def _load_table_existing_values(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
    ) -> dict[UUID, set[str]]:
        tables = await self.universe_service.tables_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        by_table: dict[UUID, set[str]] = {}
        for table in tables:
            table_id = table.get("table_id")
            if not isinstance(table_id, UUID):
                continue
            values = by_table.setdefault(table_id, set())
            members = table.get("members") if isinstance(table.get("members"), list) else []
            for member in members:
                if not isinstance(member, dict):
                    continue
                normalized = self._normalize_text(member.get("value"))
                if normalized:
                    values.add(normalized)
        return by_table

    @staticmethod
    def _bundle_summary(
        bundle_key: str,
        bundle_version: int,
        bundle_name: str,
        bundle_description: str,
        bundle_tags: list[str],
        parsed: ParsedBundleManifest,
    ) -> dict[str, Any]:
        return {
            "key": bundle_key,
            "version": bundle_version,
            "name": bundle_name,
            "description": bundle_description,
            "tags": bundle_tags,
            "planets_count": len(parsed.planets),
            "moons_count": len(parsed.moons),
            "bonds_count": len(parsed.bonds),
            "formulas_count": len(parsed.formulas),
            "guardians_count": len(parsed.guardians),
        }

    async def build_apply_plan(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        bundle_key: str | None,
        manifest: dict[str, Any] | None,
        conflict_strategy: str,
        seed_rows: bool,
        target_planet_id: UUID | None = None,
    ) -> BundleApplyPlan:
        parsed_manifest: ParsedBundleManifest
        key = "custom_manifest"
        version = 1
        name = "Custom Manifest"
        description = "Ad-hoc bundle provided in request payload"
        tags: list[str] = ["custom"]

        if bundle_key:
            bundle = get_preset_bundle(bundle_key)
            if bundle is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset bundle not found")
            parsed_manifest = self._parse_manifest(bundle.manifest)
            key = bundle.key
            version = bundle.version
            name = bundle.name
            description = bundle.description
            tags = [str(item) for item in bundle.tags]
        elif manifest is not None:
            parsed_manifest = self._parse_manifest(manifest)
            name = str(manifest.get("name") or name)
            description = str(manifest.get("description") or description)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Provide bundle_key or manifest",
            )

        existing_values = await self._load_table_existing_values(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )

        if target_planet_id is not None and len(parsed_manifest.planets) != 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="planet_id can be used only for single-planet bundles.",
            )

        planet_plans: list[BundlePlanetPlan] = []
        planet_by_key: dict[str, BundlePlanetPlan] = {}
        for planet in parsed_manifest.planets:
            use_target_planet = target_planet_id is not None and len(parsed_manifest.planets) == 1
            table_id = (
                target_planet_id
                if use_target_planet
                else derive_table_id(galaxy_id=galaxy_id, table_name=planet.table_name)
            )
            schema_plan: PresetApplyPlan | None = None
            resolved_table_name = planet.table_name
            if planet.schema_preset_key:
                schema_plan = await self.schema_preset_service.build_apply_plan(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    branch_id=branch_id,
                    table_id=table_id,
                    preset_key=planet.schema_preset_key,
                    conflict_strategy=conflict_strategy,
                    target_table_name=None if use_target_planet else planet.table_name,
                    seed_rows=seed_rows,
                )
                resolved_table_name = schema_plan.table_name
                values = existing_values.setdefault(table_id, set())
                for row in schema_plan.seed_rows_to_create:
                    normalized = self._normalize_text(row.value)
                    if normalized:
                        values.add(normalized)
            plan = BundlePlanetPlan(
                planet=planet,
                table_id=table_id,
                table_name=resolved_table_name,
                schema_plan=schema_plan,
            )
            planet_plans.append(plan)
            planet_by_key[planet.key] = plan

        moon_plans: list[BundleMoonPlan] = []
        warnings: list[str] = []
        for moon in parsed_manifest.moons:
            planet_plan = planet_by_key[moon.planet_key]
            values = existing_values.setdefault(planet_plan.table_id, set())
            normalized = self._normalize_text(moon.value)
            skip_existing = bool(normalized and normalized in values)
            metadata = dict(moon.metadata)
            metadata["table"] = planet_plan.table_name
            if skip_existing:
                warnings.append(
                    f"Moon '{moon.ref}' skipped in plan (existing value in table '{planet_plan.table_name}')."
                )
            else:
                if normalized:
                    values.add(normalized)
            moon_plans.append(
                BundleMoonPlan(
                    moon=moon,
                    table_id=planet_plan.table_id,
                    table_name=planet_plan.table_name,
                    metadata=metadata,
                    skip_existing=skip_existing,
                )
            )

        return BundleApplyPlan(
            bundle_key=key,
            bundle_version=version,
            bundle_name=name,
            bundle_description=description,
            bundle_tags=tags,
            manifest=parsed_manifest,
            planets=planet_plans,
            moons=moon_plans,
            warnings=warnings,
        )

    async def _resolve_refs_from_snapshot(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        moon_plans: list[BundleMoonPlan],
    ) -> dict[str, UUID]:
        civilizations, _ = await self.universe_service.snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            as_of=None,
        )
        by_key: dict[tuple[UUID, str], list[UUID]] = {}
        for civilization in civilizations:
            if isinstance(civilization, dict):
                civilization_id = civilization.get("id")
                value = civilization.get("value")
                metadata = civilization.get("metadata") if isinstance(civilization.get("metadata"), dict) else {}
            elif isinstance(civilization, ProjectedAsteroid):
                civilization_id = civilization.id
                value = civilization.value
                metadata = civilization.metadata if isinstance(civilization.metadata, dict) else {}
            else:
                continue
            if not isinstance(civilization_id, UUID):
                continue
            table_name = derive_table_name(value=value, metadata=metadata)
            table_id = derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
            token = (table_id, self._normalize_text(value))
            by_key.setdefault(token, []).append(civilization_id)

        refs: dict[str, UUID] = {}
        for moon_plan in moon_plans:
            token = (moon_plan.table_id, self._normalize_text(moon_plan.moon.value))
            candidates = by_key.get(token, [])
            if not candidates:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Unable to resolve moon ref '{moon_plan.moon.ref}' after apply",
                )
            if len(candidates) > 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Moon ref '{moon_plan.moon.ref}' is ambiguous (multiple rows with same value)",
                )
            refs[moon_plan.moon.ref] = candidates[0]
        return refs

    @staticmethod
    def _merge_executions(
        first: TaskExecutionResult | None, second: TaskExecutionResult | None
    ) -> TaskExecutionResult | None:
        if first is None and second is None:
            return None
        merged = TaskExecutionResult()
        for item in [first, second]:
            if item is None:
                continue
            merged.civilizations.extend(item.civilizations)
            merged.bonds.extend(item.bonds)
            merged.selected_asteroids.extend(item.selected_asteroids)
            merged.extinguished_asteroids.extend(item.extinguished_asteroids)
            merged.extinguished_civilization_ids.extend(item.extinguished_civilization_ids)
            merged.extinguished_bond_ids.extend(item.extinguished_bond_ids)
            merged.semantic_effects.extend(item.semantic_effects)
        return merged

    async def apply_plan_commit(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        galaxy_id: UUID,
        branch_id: UUID | None,
        plan: BundleApplyPlan,
    ) -> BundleApplyCommitResult:
        contracts: dict[str, TableContract] = {}

        for planet_plan in plan.planets:
            if planet_plan.schema_plan is None:
                continue
            contract, _ = await self.schema_preset_service.apply_plan_commit(
                session=session,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                plan=planet_plan.schema_plan,
            )
            contracts[planet_plan.planet.key] = contract

        moon_tasks = [
            AtomicTask(action="INGEST", params={"value": moon_plan.moon.value, "metadata": dict(moon_plan.metadata)})
            for moon_plan in plan.moons
            if not moon_plan.skip_existing
        ]
        moon_execution: TaskExecutionResult | None = None
        if moon_tasks:
            moon_execution = await self.task_executor_service.execute_tasks(
                session=session,
                tasks=moon_tasks,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                manage_transaction=False,
            )

        refs = await self._resolve_refs_from_snapshot(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
            moon_plans=plan.moons,
        )

        graph_tasks: list[AtomicTask] = []
        for bond in plan.manifest.bonds:
            graph_tasks.append(
                AtomicTask(
                    action="LINK",
                    params={
                        "source_civilization_id": str(refs[bond.source_ref]),
                        "target_civilization_id": str(refs[bond.target_ref]),
                        "type": bond.bond_type,
                    },
                )
            )
        for formula in plan.manifest.formulas:
            graph_tasks.append(
                AtomicTask(
                    action="SET_FORMULA",
                    params={
                        "target": str(refs[formula.target_ref]),
                        "field": formula.field,
                        "formula": formula.formula,
                    },
                )
            )
        for guardian in plan.manifest.guardians:
            graph_tasks.append(
                AtomicTask(
                    action="ADD_GUARDIAN",
                    params={
                        "target": str(refs[guardian.target_ref]),
                        "field": guardian.field,
                        "operator": guardian.operator,
                        "threshold": guardian.threshold,
                        "action": guardian.action,
                    },
                )
            )

        graph_execution: TaskExecutionResult | None = None
        if graph_tasks:
            graph_execution = await self.task_executor_service.execute_tasks(
                session=session,
                tasks=graph_tasks,
                user_id=user_id,
                galaxy_id=galaxy_id,
                branch_id=branch_id,
                manage_transaction=False,
            )

        merged = self._merge_executions(moon_execution, graph_execution)
        return BundleApplyCommitResult(
            planet_contracts=contracts,
            created_refs=refs,
            execution=merged,
            executed_task_count=len(moon_tasks) + len(graph_tasks),
        )

    def list_bundles(self) -> list[BundleDefinition]:
        return list_preset_bundles()

    def get_bundle(self, bundle_key: str) -> BundleDefinition:
        bundle = get_preset_bundle(bundle_key)
        if bundle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset bundle not found")
        return bundle
