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
| Semantic constitution v1 | `docs/contracts/semantic-constitution-v1.md` | PARTIAL | MISSING (direct doc gate) | PARTIAL (behavioral only) | MISSING | add explicit constitution gate test |
| Galaxy workspace v1 | `docs/contracts/galaxy-workspace-contract-v1.md` | PARTIAL | PARTIAL (`tests/test_galaxy_scope_service.py`) | PARTIAL (`test_api_integration.py` foreign access paths) | PARTIAL (`useGalaxyGate`) | no dedicated contract freeze test |
| Star baseline v1 | `docs/star-contract-baseline-v1.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | PARTIAL | DONE (`starContract.test.js`) | integration asserts can be broader |
| Star physics laws v2 | `docs/contracts/star-physics-laws-v2.md` | PARTIAL | DONE (baseline v2 schema parity) | PARTIAL (`star_core` integration slices) | DONE (`starContract.test.js`, `physicsSystem.test.js`) | endpoint-by-endpoint integration sweep missing |
| Star physics baseline v2 | `docs/star-physics-contract-baseline-v2.json` | DONE | DONE (`tests/test_star_contract_baseline.py`) | PARTIAL | DONE (`starContract.test.js`) | performance/profile migration gate missing |
| Moon capability v1 | `docs/contracts/moon-contract-v1.md` | PARTIAL | PARTIAL (`tests/test_moon_contracts.py`) | PARTIAL (moon flows in `test_api_integration.py`) | PARTIAL | no dedicated Moon contract freeze gate |
| Civilization v1 | `docs/contracts/civilization-contract-v1.md` | PARTIAL | PARTIAL (asteroid/OCC behavior tests) | PARTIAL | PARTIAL | dedicated civilization contract gate missing |
| Mineral v1 | `docs/contracts/mineral-contract-v1.md` | PARTIAL | PARTIAL (table validation + calc tests) | PARTIAL | PARTIAL | dedicated mineral fact/type gate missing |

## 2. Missing automated gates (priority order)

1. Add dedicated contract freeze tests for:
- `galaxy-workspace-contract-v1.md`
- `moon-contract-v1.md`
- `civilization-contract-v1.md`
- `mineral-contract-v1.md`
- `semantic-constitution-v1.md`

2. Add endpoint closure integration gate for star physics v2:
- lock with physical profile payload
- profile read endpoint
- planet runtime endpoint

3. Add FE freeze checks beyond Star:
- table contract fields consumed by grid/workspace
- civilization/mineral fact payload shape consumed by grid panels

## 3. Current MVP blocker view

- `BLOCKER`: none for continuing implementation (core contracts exist).
- `SIGN-OFF BLOCKERS` before MVP freeze:
1. missing dedicated gates for new contracts (Galaxy/Moon/Civilization/Mineral/Semantic Constitution),
2. missing full star-physics-v2 integration closure,
3. missing FE freeze tests for non-star contracts.
