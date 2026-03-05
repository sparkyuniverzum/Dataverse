# Contract Gap Diff v2

Date: 2026-03-05  
Scope: backend + frontend contract coverage audit for MVP system layers

Legend:
- `DONE`: exists and has at least one automated gate
- `PARTIAL`: exists but gates are incomplete for target layer
- `MISSING`: not yet covered

## 1. Contract inventory and gate status

| Contract | File | Status | BE machine gate | BE integration gate | FE gate | Main gap |
|---|---|---|---|---|---|---|
| API v1 | `docs/contracts/api-v1.md` | DONE | PARTIAL (`test_api_integration.py` contract checks, no dedicated schema freeze) | DONE | PARTIAL (`dataverseApi.test.js`) | no strict OpenAPI freeze gate in CI |
| Parser v1 | `docs/contracts/parser-v1.md` | DONE | DONE (`tests/test_parser_service.py`) | DONE | PARTIAL | FE parser behavior gate is indirect |
| Parser v2 spec | `docs/contracts/parser-v2-spec.md` | DONE | DONE (`tests/test_parser2_spec_contract.py`) | DONE | PARTIAL | no FE AST/spec freeze test |
| Table contract v1 | `docs/contracts/table-contract-v1.md` | DONE | DONE (`tests/test_schemas_table_contract.py`) | DONE | PARTIAL | FE has no explicit table-contract freeze test |
| Semantic constitution v1 | `docs/contracts/semantic-constitution-v1.md` | DONE | DONE (`tests/test_semantic_constitution_contract.py`) | DONE (`test_api_integration.py::test_semantic_constitution_endpoint_by_endpoint_closure_v1`) | DONE (`src/lib/semanticConstitutionContract.test.js`, `src/lib/builderParserCommand.test.js`, `src/lib/dataverseApi.test.js`) | keep baseline examples synced with parser/operator evolution |
| Galaxy workspace v1 | `docs/contracts/galaxy-workspace-contract-v1.md` | DONE | DONE (`tests/test_galaxy_workspace_contract_baseline.py`, `tests/test_galaxy_scope_service.py`) | DONE (`test_api_integration.py` foreign access + branch promote paths) | DONE (`workspaceScopeContract.test.js`) | keep baseline + FE field inventory in sync with contract updates |
| Star baseline v1 | `docs/star-contract-baseline-v1.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | PARTIAL | DONE (`starContract.test.js`) | integration asserts can be broader |
| Star physics laws v2 | `docs/contracts/star-physics-laws-v2.md` | PARTIAL | DONE (baseline v2 schema parity) | DONE (`test_api_integration.py::test_star_core_endpoint_by_endpoint_closure_v2`) | DONE (`starContract.test.js`, `physicsSystem.test.js`) | keep endpoint closure test synced with response-model changes |
| Star physics baseline v2 | `docs/star-physics-contract-baseline-v2.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | PARTIAL | DONE (`starContract.test.js`) | performance/profile migration gate missing |
| Moon capability v1 | `docs/contracts/moon-contract-v1.md` | DONE | DONE (`tests/test_moon_contract_baseline.py`, `tests/test_moon_contracts.py`, `tests/test_moon_contract_freeze_gate.py`) | DONE (`test_api_integration.py::test_moon_first_class_crud_endpoints`) | DONE (`src/lib/moonContract.test.js`, `src/lib/dataverseApi.test.js`) | keep FE baseline sync with `docs/moon-contract-baseline-v1.json` |
| Civilization v1 | `docs/contracts/civilization-contract-v1.md` | DONE | DONE (`tests/test_civilization_contract_baseline.py`) | DONE (`test_api_integration.py::test_civilization_contract_gate_create_mutate_extinguish_and_converge`) | DONE (`workspaceContract.test.js`) | keep baseline synced with lifecycle endpoint evolution |
| Mineral v1 | `docs/contracts/mineral-contract-v1.md` | DONE | DONE (`tests/test_mineral_contract_baseline.py`) | DONE (`test_api_integration.py::test_mineral_contract_gate_typing_validation_and_facts_projection`) | DONE (`workspaceContract.test.js`) | keep enum/fact baseline synced with schema evolution |

## 2. Missing automated gates (priority order)

1. Add FE freeze checks beyond Star:
- none (semantic constitution + moon freeze gates are now covered)

## 3. Current MVP blocker view

- `BLOCKER`: none for continuing implementation (core contracts exist).
- `SIGN-OFF BLOCKERS` before MVP freeze:
1. none at contract gate layer (remaining partial items are quality/depth improvements, not missing gates).
