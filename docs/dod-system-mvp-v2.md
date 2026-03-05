# System MVP DoD v2 (Star -> Planet -> Moon -> Civilization -> Mineral)

Status: closed (MVP sign-off complete)  
Owner: Core BE/FE  
Date: 2026-03-05

## 1. Purpose

Define one shared Definition of Done for the whole Dataverse MVP system.
This DoD is technical and domain-driven, not marketing/product copy.

The goal is to avoid partial "feature done" states and enforce one system gate.

## 1.1 Closure record

MVP sign-off was closed on 2026-03-05 after all defined gate groups were implemented and validated:
- contract freeze gates (BE + FE),
- integration closure gates (including star lock -> first planet -> grid convergence),
- projection replay convergence gate (FE),
- star physics migration gate (`/star-core/physics/profile/migrate`).

Evidence (latest closure run set):
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "auth_session_lifecycle_login_refresh_logout_and_me or moon_first_class_crud_endpoints or civilization_contract_gate_create_mutate_extinguish_and_converge or mineral_contract_gate_typing_validation_and_facts_projection or star_core_endpoint_by_endpoint_closure_v2 or release_gate_star_lock_first_planet_grid_convergence or release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence or semantic_constitution_endpoint_by_endpoint_closure_v1"`
- `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py`
- `make contract-gate`

## 2. Canonical domain model (frozen for MVP)

- Star = galaxy constitution + physical law profile.
- Planet = data carrier (table aggregate).
- Moon = capability module that expands planet behavior.
- Civilization = planet population (rows) + logical grouping of keys.
- Mineral = atomic value mined by civilization (cell-level value + type + meaning).

### 2.1 Mapping to implementation

- Planet identity: `table_id` + `table_name`.
- Civilization carrier: table rows (`asteroids`) with metadata keys.
- Mineral carrier: row value + metadata fields + calculated values.
- Moon capability payload: contract/preset/rulebook and relation helpers bound to planet scope.

## 3. MVP system scope (must be complete)

1. Auth/session lifecycle is stable (`register/login/refresh/logout/me`).
2. Galaxy/workspace lifecycle is stable (list/create/select/extinguish).
3. Star laws are locked before first planet creation.
4. First planet onboarding works end-to-end (DnD -> setup -> commit -> grid).
5. Moon capabilities are usable on top of planet contract.
6. Civilization CRUD works with OCC/idempotency and soft-delete.
7. Mineral typing/validation is enforced by contract on write.
8. Universe projection (`snapshot/tables/stream`) is stable and FE-authoritative.

## 4. Moon capability minimum set (MVP)

1. Dictionary Moon: controlled value sets (enum/category lookup).
2. Validation Moon: required/type/validator/unique constraints.
3. Formula Moon: calculated minerals based on formula registry.
4. Bridge Moon: relation logic between planets (at least 1:N behavior).

Each moon type must be demonstrated in at least one integration flow.

## 5. Hard invariants (non-negotiable)

1. No hard delete in domain lifecycle.
2. OCC guard on mutable write paths.
3. Idempotency replay safety for repeated write requests.
4. Contract validation before append/project.
5. Star constitution immutable after lock.
6. Star physical profile immutable after lock (migration-only changes).
7. FE physics rendering uses BE runtime as source of truth.

## 6. Functional DoD by layer

### 6.1 Star layer

- Policy lock flow works and blocks planet onboarding until locked.
- Physical profile is stored, readable, and applied in runtime output.
- Domain metrics + pulse + runtime endpoints are available and stable.

### 6.2 Planet layer

- Planet create/list/detail/extinguish lifecycle is stable on main timeline.
- Empty planet projection is valid (no null shape drift).
- Contract version is visible and respected in FE.

### 6.3 Moon layer

- Moon capability attachment changes planet behavior deterministically.
- Dictionary/validation/formula/bridge moon effects are reflected in grid and projection.
- No moon capability can bypass contract invariants.

### 6.4 Civilization/Mineral layer

- Civilization ingest/mutate/extinguish is stable and auditable.
- Mineral schema constraints are enforced consistently on ingest and mutate.
- Soft-deleted population is hidden in active views but preserved for history.

### 6.5 Projection/UI sync layer

- `snapshot + tables + stream` converge to one consistent view.
- No phantom rows/links after write + stream replay.
- Grid state and 3D state represent same source timeline.

## 7. Endpoint closure map (minimum gate)

| Layer | Endpoint group | Required status |
|---|---|---|
| Auth | `/auth/*` | must pass integration gate |
| Galaxy | `/galaxies`, `/branches` | must pass integration gate |
| Star | `/galaxies/{id}/star-core/*` | must pass contract + integration gate |
| Planet | `/planets`, `/contracts/{table_id}` | must pass lifecycle + contract gate |
| Civilization | `/asteroids/*`, `/tasks/execute-batch`, `/parser/execute` | must pass OCC/idempotency/validation gate |
| Moon bridge | `/bonds/*` | must pass relation integrity gate |
| Projection | `/universe/snapshot`, `/universe/tables`, `/galaxies/{id}/events/stream` | must pass convergence gate |

## 8. Contract closure set (must exist and be test-gated)

1. `docs/contracts/api-v1.md`
2. `docs/api-v1-openapi-baseline-v1.json`
3. `docs/contracts/parser-v1.md`
4. `docs/contracts/parser-v2-spec.md`
5. `docs/contracts/table-contract-v1.md`
6. `docs/contracts/semantic-constitution-v1.md`
7. `docs/contracts/galaxy-workspace-contract-v1.md`
8. `docs/star-contract-baseline-v1.json`
9. `docs/contracts/star-physics-laws-v2.md`
10. `docs/star-physics-contract-baseline-v2.json`
11. `docs/contracts/moon-contract-v1.md`
12. `docs/moon-contract-baseline-v1.json`
13. `docs/contracts/civilization-contract-v1.md`
14. `docs/civilization-contract-baseline-v1.json`
15. `docs/contracts/mineral-contract-v1.md`
16. `docs/mineral-contract-baseline-v1.json`
17. `docs/contracts/contract-gap-diff-v2.md` (authoritative gap matrix for sign-off readiness)
18. `docs/contracts/planet-builder-mvp-v2.md`

## 9. Test gate (MVP sign-off commands)

### 9.1 Contract gates

- `PYTHONPATH=. pytest -q tests/test_star_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_api_v1_openapi_freeze.py`
- `PYTHONPATH=. pytest -q tests/test_galaxy_workspace_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_moon_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_moon_contract_freeze_gate.py`
- `PYTHONPATH=. pytest -q tests/test_civilization_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_mineral_contract_baseline.py`
- `PYTHONPATH=. pytest -q tests/test_semantic_constitution_contract.py`
- `PYTHONPATH=. pytest -q tests/test_planet_builder_mvp_contract.py`
- `PYTHONPATH=. pytest -q tests/test_parser2_spec_contract.py tests/test_parser_service.py -k "contract"`
- `PYTHONPATH=. pytest -q tests/test_schemas_table_contract.py`
- `cd frontend && npm test -- --run src/components/universe/starContract.test.js src/components/universe/scene/physicsSystem.test.js`
- `cd frontend && npm test -- --run src/lib/apiV1Contract.test.js src/lib/dataverseApi.test.js`
- `cd frontend && npm test -- --run src/lib/tableContract.test.js src/components/universe/workspaceContract.test.js src/components/universe/workspaceFormatters.test.js`
- `cd frontend && npm test -- --run src/lib/parserContract.test.js src/lib/builderParserCommand.test.js src/lib/parserExecutionMode.test.js src/lib/dataverseApi.test.js`
- `cd frontend && npm test -- --run src/lib/semanticConstitutionContract.test.js src/lib/builderParserCommand.test.js src/lib/dataverseApi.test.js`
- `cd frontend && npm test -- --run src/lib/moonContract.test.js src/lib/dataverseApi.test.js`
- `cd frontend && npm test -- --run src/components/universe/projectionConvergenceGate.test.js src/components/universe/runtimeSyncUtils.test.js src/lib/hierarchy_layout.test.js`

### 9.2 Integration gates

- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "star_core_endpoint_by_endpoint_closure_v2 or star_core or table_contract or snapshot_v1_contract_contains_table_projection_fields or tables_v1_contract_contains_sector_and_bond_buckets"`
- `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "moon_first_class_crud_endpoints"`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "civilization_contract_gate_create_mutate_extinguish_and_converge"`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "mineral_contract_gate_typing_validation_and_facts_projection"`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "release_gate_star_lock_first_planet_grid_convergence or release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence"`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "semantic_constitution_endpoint_by_endpoint_closure_v1"`
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py`

### 9.3 Build gate

- `cd frontend && npm run build -- --mode staging`

## 10. End-to-end acceptance scenarios (mandatory)

1. New user:
   `register/login -> galaxy resolve -> star lock -> first planet create -> setup commit -> grid open`.
2. Civilization safety:
   `ingest -> mutate -> OCC conflict retry -> soft delete -> projection refresh`.
3. Moon expansion:
   apply dictionary/validation/formula/bridge capability and verify runtime + grid effect.
4. Convergence:
   write operation + stream replay leads to identical 3D and grid state after refresh.

## 11. Release gate (MVP exit criteria)

1. All contract gates are green.
2. All integration gates are green.
3. Staging build is green.
4. No open P0/P1 system defects.
5. Migration path is forward-only and documented.

## 12. Out of scope for MVP

1. Multi-star topology per galaxy.
2. Full time-travel UX and historical scrubber.
3. Advanced shader fidelity beyond deterministic phase/corrosion readability.
4. Automatic profile tuning by ML/heuristic optimizer.
