# Planet/Civilization Test Matrix v1

Status: active (Wave 0 skeleton)
Date: 2026-03-07
Owner: QA + BE + FE
Depends on: `docs/contracts/planet-civilization-logical-flow-dod-v1.md`, `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/bond-preview-validate-contract-v1.md`, `docs/contracts/moon-impact-contract-v1.md`

## 1. Purpose

Provide one traceable gate matrix for `LF-01..LF-08` across:
1. BE integration tests,
2. FE unit/component tests,
3. FE e2e staging tests.

## 2. Matrix

| LF ID | Scope | BE integration gate | FE unit/component gate | FE e2e staging gate | Status |
|---|---|---|---|---|---|
| `LF-01` | Moon discoverability + inspection | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf01_moon_discoverability_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-01`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-01`) | SKELETON |
| `LF-02` | Civilization vs Mineral semantics | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf02_semantic_clarity_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-02`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-02`) | SKELETON |
| `LF-03` | Mineral workflow closure | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf03_mineral_workflow_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-03`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-03`) | SKELETON |
| `LF-04` | Bond builder deterministic flow | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf04_bond_builder_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-04`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-04`) | SKELETON |
| `LF-05` | Visual builder guard machine | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf05_state_machine_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-05`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-05`) | SKELETON |
| `LF-06` | Multi-planet onboarding/laws | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf06_cross_planet_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-06`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-06`) | SKELETON |
| `LF-07` | Convergence + replay parity | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf07_replay_parity_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-07`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-07`) | SKELETON |
| `LF-08` | Accessibility + performance parity | `tests/test_planet_civilization_lf_matrix_placeholder.py::test_lf08_accessibility_performance_placeholder` | `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` (`LF-08`) | `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` (`LF-08`) | SKELETON |

## 3. Placeholder policy

1. Placeholder tests are intentionally `skip` until implementation waves begin.
2. Each placeholder must be replaced by real gate before LF closure.
3. Matrix status moves:
   - `SKELETON` -> `ACTIVE` when real assertion logic is merged,
   - `ACTIVE` -> `GREEN` when gate passes in staging evidence.

## 4. DoD for this matrix

1. BE + FE + e2e placeholder gates exist in repository.
2. Every `LF-*` row maps to one gate in each lane.
3. Matrix is referenced by Wave 0 (`W0-LF-13`).
