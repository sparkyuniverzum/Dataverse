# Civilization + Mineral Contract v2

Status: archived (merged into `docs/contracts/planet-civilization-domain-canonical-v1.md`)
Date: 2026-03-06
Owner: Core BE/FE architecture
Depends on: `docs/contracts/civilization-contract-v1.md`, `docs/contracts/mineral-contract-v1.md`, `docs/contracts/moon-contract-v1.md`, `docs/contracts/table-contract-v1.md`, `docs/contracts/planet-moon-dod-v3.md`

Merged into:
- `docs/contracts/planet-civilization-domain-canonical-v1.md`

## 1. Purpose

Unify Civilization and Mineral into one executable contract layer:
- Civilization = lifecycle aggregate (identity, timeline, health, state),
- Mineral = typed atomic value unit carried by civilization.

This document defines required runtime behavior for write paths, read models, FE interaction, and release gates.

## 2. Canonical ontology

1. Civilization is not a generic row; it is a versioned runtime entity bound to one planet.
2. Mineral is not only a UI cell; it is a typed contract atom with validation semantics.
3. Civilization health is derived from mineral validity and reference integrity.
4. Soft-delete is the only delete mode.

Invariant: `Civilization lifecycle` and `Mineral validity` must converge to the same state across API, projection, grid, and 3D preview.

## 3. Domain vocabulary mapping

Civilization mineral classes (domain language):
- `KRYSTAL` -> textual semantic value (`string`)
- `IZOTOP` -> quantitative value (`number`)
- `CHRONON` -> temporal value (`datetime`)
- `MOST` -> reference value (`reference`)

Runtime read-model `value_type` mapping:
- `KRYSTAL` -> `string`
- `IZOTOP` -> `number`
- `CHRONON` -> `datetime`
- `MOST` -> `string|json` (must include reference envelope)

## 4. Canonical carriers

Current runtime carrier:
- civilization row: asteroid (`id`, `table_id`, `value`, `metadata`, `is_deleted`, `current_event_seq`)
- minerals in projection facts: `facts[]` (`key`, `typed_value`, `value_type`, `source`, `status`, `errors`)

Target v2 authoritative envelope:
- civilization envelope + mineral envelope (sections 5 and 6) must be available in detail response and projection rows.

## 5. Civilization envelope (required fields)

Required shape (canonical):
- `civilization_id`
- `planet_id`
- `galaxy_id`
- `is_deleted`
- `current_event_seq`
- `state` (`ACTIVE|WARNING|ANOMALY|ARCHIVED`)
- `health_score` (`0..100`)
- `violation_count`
- `last_violation_at` (nullable datetime)
- `facts` (mineral facts array)

State resolution rules:
1. `ARCHIVED` iff `is_deleted=true`.
2. `ANOMALY` iff any critical mineral violation is active.
3. `WARNING` iff non-critical violations exist and no critical violation exists.
4. `ACTIVE` otherwise.

## 6. Mineral envelope (required fields)

Each mineral fact must expose:
- `key` (`mineral_key`)
- `typed_value`
- `value_type`
- `source` (`value|metadata|calculated|repair`)
- `status` (`valid|hologram|invalid|deprecated`)
- `errors[]` (typed list; empty when valid)

For write-path explainability, violation detail must include:
- `rule_id`
- `capability_id` (if contract capability was source of violation)
- `mineral_key`
- `actual_value`
- `expected_constraint`
- `repair_hint` (nullable)

## 7. Lifecycle + command contract

Civilization commands:
- `create` (ingest)
- `mutate` (upsert mineral payload)
- `extinguish` (soft-delete)

Mineral-level command semantics inside mutate:
- `UPSERT_MINERAL` (`key`, `raw_value`)
- `REPAIR_MINERAL` (`key`, `strategy`, `raw_value`)
- `REMOVE_MINERAL_SOFT` (marks value inactive in facts lineage; no hard delete)

Write invariants:
1. OCC enforced when `expected_event_seq` is provided.
2. Idempotency enforced on write commands.
3. Invalid mineral payload must not append a successful write event.
4. Replay on same event timeline must yield same mineral fact set.

## 8. API surface and compatibility contract

Canonical runtime API surface:
- `GET /civilizations`
- `GET /civilizations/{civilization_id}`
- `POST /civilizations`
- `PATCH /civilizations/{civilization_id}/mutate`
- `PATCH /civilizations/{civilization_id}/minerals/{mineral_key}`
- `PATCH /civilizations/{civilization_id}/extinguish`

Compatibility alias (allowed, not canonical):
- `/moons*` routes must preserve parity and expose canonical route marker header.

Error taxonomy:
- `400` invalid payload/semantic command
- `401` auth/session invalid
- `403` foreign galaxy/branch access
- `404` target missing in resolved scope
- `409` OCC/idempotency conflict
- `422` structured contract violation (never generic plain error for contract failure)

### 8.0 Canonical route policy freeze (2026-03-07)

Non-negotiable policy:
1. `/civilizations*` is canonical for all new runtime clients.
2. `/moons*` is compatibility alias only and cannot be primary in new implementations.
3. Alias fallback is allowed only for compatibility statuses (`404`, `405`, `501`) when canonical route is unavailable.
4. Alias responses must include:
   - `X-Dataverse-Deprecated-Alias: true`
   - `X-Dataverse-Canonical-Route: /civilizations`
5. Alias/canonical parity is mandatory for payload fields, OCC/idempotency behavior, and soft-delete semantics.

### 8.2 Explainability envelope freeze (2026-03-07)

Canonical violation keys:
1. `rule_id`
2. `capability_id`
3. `mineral_key`
4. `expected_constraint`
5. `repair_hint`

Compatibility keys (still required during migration window):
1. `expected_type`
2. `operator`
3. `expected_value`

Parity rule:
- if both canonical and compatibility keys are present, values must be semantically equivalent.

### 8.1 Backend capability snapshot (as-is, 2026-03-06)

Implemented in `app/api/routers/moons.py`:
1. `GET /civilizations` (+ `/moons` alias)
- query: `galaxy_id`, `branch_id`, `planet_id`
- response: `MoonListResponse(items: MoonRowContract[])`

2. `GET /civilizations/{civilization_id}` (+ `/moons/{moon_id}` alias)
- query: `galaxy_id`, `branch_id`
- response: `MoonRowContract`

3. `POST /civilizations` (+ `/moons` alias)
- body: `MoonCreateRequest { planet_id, label, minerals, idempotency_key?, galaxy_id?, branch_id? }`
- behavior: resolves planet table name, writes via task executor `INGEST`, idempotent wrapper enabled.

4. `PATCH /civilizations/{civilization_id}/mutate` (+ `/moons/{moon_id}/mutate` alias)
- body: `MoonMutateRequest { label?, minerals, planet_id?, expected_event_seq?, idempotency_key?, galaxy_id?, branch_id? }`
- behavior: writes via task executor `UPDATE_ASTEROID`, OCC + idempotency supported.

5. `PATCH /civilizations/{civilization_id}/extinguish` (+ `/moons/{moon_id}/extinguish` alias)
- query: `galaxy_id`, `branch_id`, `expected_event_seq`, `idempotency_key`
- behavior: writes via task executor `EXTINGUISH`, soft-delete only.

6. `PATCH /civilizations/{civilization_id}/minerals/{mineral_key}` (+ `/moons/{moon_id}/minerals/{mineral_key}` alias)
- body: `CivilizationMineralMutateRequest { typed_value?, remove?, expected_event_seq?, idempotency_key?, galaxy_id?, branch_id? }`
- behavior: dedicated mineral upsert/remove path mapped to `UPDATE_ASTEROID` with OCC + idempotency.

Facts payload (current BE output):
- `MoonRowContract` includes `facts: MineralFact[]` with:
  - `key`, `typed_value`, `value_type`, `source`, `status`, `readonly`, `errors[]`, `unit?`
- `MoonRowContract` also includes civilization health envelope:
  - `state`, `health_score`, `violation_count`, `last_violation_at`
- projection builder: `build_moon_facts(...)` merges `value + metadata + calculated_values + calc_errors`.

Alias compatibility marker:
- middleware in `app/main.py` sets `X-Dataverse-Canonical-Route: /civilizations` for `/moons*` requests.

Residual BE gap against v2 target:
1. `last_violation_at` currently uses deterministic row-level fallback timestamp until per-violation event timestamping is introduced.

## 9. Read-model + projection contract

Required projection behavior:
1. Active views do not include archived civilizations.
2. Historical replay can reconstruct archived civilization history.
3. Mineral facts in projection are typed and source-aware.
4. Formula/circular errors are explicit and non-silent in facts.

Convergence rule:
- `civilizations detail`, `universe snapshot`, `tables projection`, and FE grid must show equivalent mineral facts for the same event sequence.

## 10. FE interaction contract (logic layer, non-visual)

Required UX logic:
1. Planet selection in workspace opens civilization grid for selected planet.
2. Grid row selection binds selected civilization id in workspace state.
3. Closing grid does not clear selected planet/civilization identity.
4. Mineral edit operation maps to civilization mutate with explicit mineral keys.
5. Contract violation response renders deterministic explainability payload.
6. FE explainability mapper (`frontend/src/components/universe/workspaceContractExplainability.js`) treats
   `expected_constraint` + `repair_hint` as canonical and derives legacy fields (`expected_type`, `operator`, `expected_value`) only as fallback.

## 11. Invariants (non-negotiable)

1. No hard delete for civilization or mineral history.
2. Civilization and mineral states must be deterministic for same timeline.
3. Branch isolation and multi-tenant scope isolation are mandatory.
4. Alias `/moons*` cannot diverge from canonical `/civilizations*` semantics.
5. FE may not invent authoritative mineral validity; it renders BE-authoritative validity.

## 12. Gate matrix

Status legend:
- `GREEN`: implemented and covered by existing automated gate.
- `PARTIAL`: behavior exists but closure scope is incomplete.
- `OPEN`: required logic exists only partially and lacks explicit gate.
- `ADD`: required new gate not yet present.

| ID | Scope | Gate type | Status | Target test / command |
|---|---|---|---|---|
| CMV2-01 | Civilization lifecycle create/mutate/extinguish convergence | BE integration | GREEN | `tests/test_api_integration.py::test_civilization_contract_gate_create_mutate_extinguish_and_converge` |
| CMV2-02 | Mineral typing/validation/facts projection | BE integration | GREEN | `tests/test_api_integration.py::test_mineral_contract_gate_typing_validation_and_facts_projection` |
| CMV2-03 | Structured explainability payload | BE integration | GREEN | `tests/test_api_integration.py::test_contract_violation_explainability_payload_shape` |
| CMV2-04 | Bulk civilization write OCC + idempotency | BE integration | GREEN | `tests/test_api_integration.py::test_bulk_civilization_writes_occ_idempotency` |
| CMV2-05 | `/moons*` alias parity with `/civilizations*` | BE integration | GREEN | `tests/test_api_integration.py::test_moons_alias_deprecation_marker_and_parity` |
| CMV2-06 | Domain payload shape stability (civilization/moon/mineral) | BE contract | GREEN | `tests/test_domain_payload_contract_shapes.py::test_civilization_moon_mineral_payload_shapes_are_frozen` |
| CMV2-07 | Planet select opens civilization grid deterministically | FE e2e/staging | GREEN | `frontend/src/lib/civilizationWorkspaceSelectionGate.test.js` + `npm --prefix frontend run test:e2e:workspace-starlock` (`1 passed`, 2026-03-06) |
| CMV2-08 | Grid mineral edit -> mutate -> facts convergence | FE+BE integration | GREEN | `tests/test_api_integration.py::test_civilization_mineral_edit_mutate_facts_convergence_v1` + `frontend/src/lib/civilizationRuntimeRouteGate.test.js` |
| CMV2-09 | Mineral-level mutate endpoint contract (`/civilizations/{id}/minerals/{key}`) | BE API | GREEN | `tests/test_api_integration.py::test_civilization_mineral_endpoint_patch_remove_and_health` |
| CMV2-10 | Civilization health state derivation from mineral violations | BE read-model | GREEN | `tests/test_moon_contracts.py::test_derive_civilization_health_flags_anomaly_on_invalid_facts` |

## 13. DoD v2 closure criteria

1. `CMV2-01` .. `CMV2-10` are `GREEN`.
2. Planet -> Civilization -> Mineral flow is deterministic across live and replay timelines.
3. All contract violations are explainable at mineral granularity.
4. Closure status is reflected in `docs/contracts/planet-moon-dod-v3.md`.

## 14. Execution backlog for closure (historical)

1. DONE (2026-03-06): dedicated FE gate for planet-click-to-grid logic executed and synchronized with staging evidence (`CMV2-07`).
2. DONE (2026-03-06): staging evidence for `CMV2-07` executed and linked in release notes.
