# Contract Gap Diff v2

Date: 2026-03-05
Scope: backend + frontend contract coverage audit for MVP system layers
Status: closed for core contract inventory (P6/LF closure tracked in dedicated backlog docs)

Legend:
- `DONE`: exists and has at least one automated gate
- `PARTIAL`: exists but gates are incomplete for target layer
- `MISSING`: not yet covered

## 1. Contract inventory and gate status

| Contract | File | Status | BE machine gate | BE integration gate | FE gate | Main gap |
|---|---|---|---|---|---|---|
| API v1 | `docs/contracts/api-v1.md` | DONE | DONE (`tests/test_api_v1_openapi_freeze.py`) | DONE | DONE (`src/lib/apiV1Contract.test.js`, `src/lib/dataverseApi.test.js`) | keep FE endpoint inventory synced with OpenAPI baseline and URL helper changes |
| Parser v1 | `docs/contracts/parser-v1.md` | DONE | DONE (`tests/test_parser_service.py`) | DONE | DONE (`src/lib/parserContract.test.js`, `src/lib/builderParserCommand.test.js`) | keep FE command builders synced with parser deterministic order/compat rules |
| Parser v2 spec | `docs/contracts/parser-v2-spec.md` | DONE | DONE (`tests/test_parser2_spec_contract.py`) | DONE | DONE (`src/lib/parserContract.test.js`, `src/lib/parserExecutionMode.test.js`) | keep operator inventory and parser payload defaults aligned with parser-v2 spec |
| Table contract v1 | `docs/contracts/table-contract-v1.md` | DONE | DONE (`tests/test_schemas_table_contract.py`) | DONE | DONE (`src/lib/tableContract.test.js`, `src/components/universe/workspaceContract.test.js`) | keep field inventories synced with `UniverseTableSnapshot` schema changes |
| Semantic constitution v1 | `docs/contracts/semantic-constitution-v1.md` | DONE | DONE (`tests/test_semantic_constitution_contract.py`) | DONE (`test_api_integration.py::test_semantic_constitution_endpoint_by_endpoint_closure_v1`) | DONE (`src/lib/semanticConstitutionContract.test.js`, `src/lib/builderParserCommand.test.js`, `src/lib/dataverseApi.test.js`) | keep baseline examples synced with parser/operator evolution |
| Galaxy workspace v1 | `docs/contracts/galaxy-workspace-contract-v1.md` | DONE | DONE (`tests/test_galaxy_workspace_contract_baseline.py`, `tests/test_galaxy_scope_service.py`) | DONE (`test_api_integration.py` foreign access + branch promote paths) | DONE (`workspaceScopeContract.test.js`) | keep baseline + FE field inventory in sync with contract updates |
| Star baseline v1 | `docs/star-contract-baseline-v1.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | DONE (`tests/test_star_core_integration_freeze.py::test_star_baseline_v1_integration_freeze_gate`) | DONE (`starContract.test.js`) | keep baseline field lists synced with response model changes |
| Star physics laws v2 | `docs/contracts/star-physics-laws-v2.md` | DONE | DONE (baseline v2 schema parity) | DONE (`tests/test_api_integration.py::test_star_core_endpoint_by_endpoint_closure_v2`, `tests/test_star_core_integration_freeze.py::test_star_physics_v2_integration_freeze_gate`) | DONE (`starContract.test.js`, `physicsSystem.test.js`) | keep endpoint closure and phase/visual key asserts synced with runtime model changes |
| Star physics baseline v2 | `docs/star-physics-contract-baseline-v2.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | DONE (`tests/test_star_core_integration_freeze.py::test_star_physics_profile_migration_and_limit_guard_gate`) | DONE (`starContract.test.js`) | keep migrate request/response baseline synced with schema model changes |
| Moon capability v1 | `docs/contracts/moon-contract-v1.md` | DONE | DONE (`tests/test_moon_contract_baseline.py`, `tests/test_moon_contracts.py`, `tests/test_moon_contract_freeze_gate.py`) | DONE (`test_api_integration.py::test_moon_first_class_crud_endpoints`) | DONE (`src/lib/moonContract.test.js`, `src/lib/dataverseApi.test.js`) | keep FE baseline sync with `docs/moon-contract-baseline-v1.json` |
| Civilization v1 | `docs/contracts/civilization-contract-v1.md` | DONE | DONE (`tests/test_civilization_contract_baseline.py`) | DONE (`test_api_integration.py::test_civilization_first_class_alias_endpoints`, `test_api_integration.py::test_civilization_contract_gate_create_mutate_extinguish_and_converge`) | DONE (`workspaceContract.test.js`) | keep baseline synced with lifecycle endpoint evolution and `/civilizations*` canonical naming rollout |
| Mineral v1 | `docs/contracts/mineral-contract-v1.md` | DONE | DONE (`tests/test_mineral_contract_baseline.py`) | DONE (`test_api_integration.py::test_mineral_contract_gate_typing_validation_and_facts_projection`) | DONE (`workspaceContract.test.js`) | keep enum/fact baseline synced with schema evolution |
| Planet Builder MVP v2 | `docs/contracts/planet-builder-mvp-v2.md` | DONE | DONE (`tests/test_contract_docs_closure.py`, `tests/test_planet_builder_mvp_contract.py`) | DONE (`test_api_integration.py::test_release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence`) | DONE (`src/components/universe/projectionConvergenceGate.test.js`, `src/components/universe/moonWriteDefaults.test.js`, `src/components/universe/workspaceUiPersistence.test.js`) | keep ontology (`Moon capability != Civilization row`) aligned with endpoint naming migration (`docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`) |

## 2. Missing automated gates (priority order)

1. Add FE freeze checks beyond Star:
- none (semantic constitution + moon freeze gates are now covered)

## 3. Current MVP blocker view

- `BLOCKER`: none for continuing implementation (core contracts exist).
- `SIGN-OFF BLOCKERS` before MVP freeze:
1. none at contract gate layer (closure complete).
2. projection convergence replay gate is covered (`src/components/universe/projectionConvergenceGate.test.js`).
3. P6/LF closure status is managed in:
   - `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`
   - `docs/contracts/planet-moon-dod-v3.md`
