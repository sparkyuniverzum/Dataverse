# Planet+Moon P1 Backlog v1

Status: active  
Date: 2026-03-06  
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`

## 1. Goal

Open execution backlog for post-P0 hardening:
- canonical runtime naming closure,
- compatibility-window governance,
- capability compatibility matrix,
- BE->FE visual-law parity.

P0 closure prerequisite is satisfied (`PM-P0-01` .. `PM-P0-08` all green).

## 2. Priority order

1. `PM-P1-01` Runtime naming closure (`/civilizations*` canonical).
2. `PM-P1-02` Compatibility window (`/moons*` parity + deprecation marker).
3. `PM-P1-03` Capability compatibility matrix freeze.
4. `PM-P1-04` Planet visual-law parity gate.

## 3. Scope items

## 3.1 PM-P1-01 `/civilizations*` canonical runtime

Target:
- FE write paths use `/civilizations*` as primary endpoint family everywhere.

DoD:
1. FE route helpers default to `/civilizations*`.
2. Fallback to `/moons*` remains compatibility-only.
3. Gate exists: `frontend/src/lib/civilizationRuntimeRouteGate.test.js`.

## 3.2 PM-P1-02 `/moons*` compatibility window

Target:
- Keep parity while making deprecation explicit.

DoD:
1. `/moons*` responses expose explicit deprecation marker (header or body field).
2. Payload parity with `/civilizations*` remains test-guarded.
3. Gates:
   - `tests/test_api_integration.py::test_moons_alias_deprecation_marker_and_parity`
   - FE route inventory parity freeze gate.

## 3.3 PM-P1-03 Capability compatibility matrix

Target:
- Define allowed/forbidden capability combinations and deterministic conflict outcome.

DoD:
1. Matrix exists as contract baseline.
2. Forbidden combinations fail before commit with machine-readable reason.
3. Gate: `tests/test_moon_contract_freeze_gate.py::test_capability_matrix_freeze_v1`.

## 3.4 PM-P1-04 Planet visual-law parity

Target:
- Ensure FE does not drift from BE physical-law semantics.

DoD:
1. FE uses BE-authoritative metrics (`phase`, `metrics`, `visual`) without semantic reinterpretation.
2. Gate: `frontend/src/components/universe/planetPhysicsParity.test.js`.
3. Drift between BE payload and FE mapping is treated as release blocker.

## 4. Execution gate pack

Backend:
- `pytest -q tests/test_api_integration.py -k "moon_first_class_crud_endpoints or civilization_first_class_alias_endpoints"`
- `pytest -q tests/test_api_integration.py -k "test_moons_alias_deprecation_marker_and_parity"`
- `pytest -q tests/test_moon_contract_freeze_gate.py -k "capability_matrix_freeze_v1"`

Frontend:
- `cd frontend && npm test -- --run src/lib/civilizationRuntimeRouteGate.test.js`
- `cd frontend && npm test -- --run src/components/universe/planetPhysicsParity.test.js`

Integrated:
- `make star-contract-gate`

## 5. Exit criteria

1. All `PM-P1-*` rows in `docs/contracts/planet-moon-dod-v3.md` are `GREEN`.
2. `/civilizations*` is canonical across FE runtime write paths.
3. `/moons*` stays compatibility-only with explicit deprecation semantics.
