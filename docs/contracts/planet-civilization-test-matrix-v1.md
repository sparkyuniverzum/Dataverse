# Planet/Civilization Test Matrix v1

Status: archived (merged into `docs/contracts/planet-civilization-delivery-canonical-v1.md`)
Date: 2026-03-08
Owner: QA + BE + FE
Depends on: `docs/contracts/planet-civilization-logical-flow-dod-v1.md`, `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/bond-preview-validate-contract-v1.md`, `docs/contracts/moon-impact-contract-v1.md`

Merged into:
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`

## 1. Purpose

Provide one traceable gate matrix for `LF-01..LF-08` across:

1. BE integration tests,
2. FE unit/component tests,
3. FE e2e staging tests.

## 2. Matrix

| LF ID   | Scope                              | BE integration gate                                                                                                         | FE unit/component gate                                                                    | FE e2e staging gate                                                       | Status |
| ------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| `LF-01` | Moon discoverability + inspection  | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf01_moon_discoverability_and_impact_endpoint`               | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-01`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-02` | Civilization vs Mineral semantics  | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf02_semantic_clarity_snapshot_contains_lifecycle_and_facts` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-02`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-03` | Mineral workflow closure           | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf03_mineral_workflow_upsert_and_remove_soft`                | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-03`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-04` | Bond builder deterministic flow    | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf04_bond_preview_gate_has_reject_and_structured_decision`   | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-04`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-05` | Visual builder guard machine       | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf05_state_machine_contract_rejects_invalid_mutate_shape`    | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-05`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-06` | Multi-planet onboarding/laws       | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf06_cross_planet_preview_flags_cross_planet_context`        | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-06`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-07` | Convergence + replay parity        | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf07_snapshot_replay_parity_is_deterministic_without_writes` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-07`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |
| `LF-08` | Accessibility + performance parity | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf08_limit_guard_is_enforced_for_moon_impact`                | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-08`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` | GREEN |

## 3. Placeholder policy

1. LF lanes must remain executable in BE + FE + staging.
2. Each LF row must map to concrete gate artifacts, not placeholders.
3. Matrix status moves:
   - `ACTIVE` -> `GREEN` when gate passes in staging evidence.

## 4. DoD for this matrix

1. BE + FE + e2e executable gates exist in repository.
2. Every `LF-*` row maps to one gate in each lane.
3. Matrix is referenced by Wave 0 (`W0-LF-13`).

Latest evidence snapshot (2026-03-10):
1. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` -> `1 passed`
