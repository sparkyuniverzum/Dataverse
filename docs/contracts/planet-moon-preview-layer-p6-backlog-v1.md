# Planet+Moon Preview Layer P6 Backlog v1

Status: active
Date: 2026-03-06
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/star-physics-laws-v2.md`, `docs/contracts/planet-builder-mvp-v2.md`, `docs/contracts/civilization-mineral-contract-v2.md`, `docs/contracts/planet-civilization-logical-flow-dod-v1.md`

## 1. Goal

Close the missing Planet/Moon preview layer so users can reliably understand:

- planet state (active/corroding/critical),
- moon/orbit behavior,
- convergence between grid lifecycle and 3D preview.

This backlog is focused on preview correctness and readability, not aesthetic redesign.

## 2. Priority order

1. `PM-P6-01` Planet preview payload parity and freeze.
2. `PM-P6-02` Moon orbit readability and high-count stability.
3. `PM-P6-03` Planet/Moon preview convergence over lifecycle + replay.
4. `PM-P6-04` Browser smoke for full preview layer behavior.
5. `PM-P6-05` Camera choreography and focus determinism.
6. `PM-P6-06` In-context causal guidance for Planet/Moon states.
7. `PM-P6-07` Interaction fail-safe and recoverability.
8. `PM-P6-08` Accessibility + reduced-motion parity.
9. `PM-P6-09` Preview performance envelope.
10. `PM-P6-10` Workspace resume/persistence continuity.

Civilization+Mineral coupling baseline:

- `CMV2-07`: planet selection -> civilization grid open determinism
- `CMV2-08`: mineral edit -> mutate -> facts convergence
- `CMV2-09`: mineral-level endpoint contract (`GREEN`)
- `CMV2-10`: civilization health derivation from mineral violations (`GREEN`)

Status legend:

- `GREEN`: gate exists and passed in the current local verification snapshot.
- `PARTIAL`: implementation/gate exists, but closure is incomplete (missing dedicated BE/staging closure evidence).
- `OPEN`: required gate artifact is missing.

Verification snapshot (2026-03-07, local):

- `cd frontend && npm test -- src/components/universe/planetPhysicsParity.test.js src/lib/hierarchy_layout.test.js src/components/universe/scene/physicsSystem.test.js src/components/universe/projectionConvergenceGate.test.js src/components/universe/workspaceContractExplainability.test.js src/components/universe/planetBuilderFlow.test.js src/components/universe/planetBuilderWizardPanel.component.test.jsx src/components/universe/accessibilityPreview.test.jsx src/components/universe/scene/performanceBudget.test.js src/components/universe/workspaceUiPersistence.test.js` -> `10 files, 40 tests passed`.
- `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed (2.2m)` (`PM-P6-07A` / `CMV2-07` evidence).
- Dedicated BE preview parity gate is now present: `tests/test_api_integration.py::test_planet_preview_payload_parity_v1` (`PM-P6-01A`); local targeted pytest is currently `skipped` when API server is unavailable.
- Dedicated BE preview lifecycle gate is now present: `tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1` (`PM-P6-03A`); local targeted pytest is currently `skipped` when API server is unavailable.
- `npm --prefix frontend run test:e2e:planet-moon-preview` -> first run failed (`180000ms timeout`), immediate rerun passed (`1 passed`, `1.8m`).
- `npm --prefix frontend run test:e2e:accessibility-preview` -> `1 passed (3.6m)`.
- `npm --prefix frontend run test:e2e:preview-performance` -> `1 passed (1.9m)`.
- `npm --prefix frontend run test:e2e:workspace-resume-preview` -> initial failures (`workspace-root`/`quick-grid-overlay` after reload), then fixed and passed (`1 passed`, `2.3m`).
- `npm --prefix frontend run test:e2e:camera-focus-flow` -> `1 passed (3.1m)`.
- `./scripts/staging_camera_focus_flow_smoke.sh` -> `PASS` (`1 passed`, `3.1m`).

Current state:

- `PM-P6-01`: `PARTIAL` (FE parity gate `GREEN`; dedicated BE parity gate added, but live API execution evidence in this local snapshot is pending).
- `PM-P6-02`: `GREEN` (FE orbit/layout/physics gates pass).
- `PM-P6-03`: `PARTIAL` (dedicated BE preview-lifecycle gate added; live API execution evidence in this local snapshot is pending).
- `PM-P6-04`: `GREEN` (staging smoke command executed; rerun confirms passing evidence).
- `PM-P6-05`: `GREEN` (component + staging smoke/script gate evidence recorded).
- `PM-P6-06`: `GREEN` (causal guidance gates pass).
- `PM-P6-07`: `GREEN` (component gate `GREEN` + staging command evidence recorded).
- `PM-P6-08`: `GREEN` (unit gate `GREEN` + staging execution evidence recorded).
- `PM-P6-09`: `GREEN` (unit gate `GREEN` + staging execution evidence recorded).
- `PM-P6-10`: `GREEN` (resume staging smoke fixed and passing).

Coupled CMV2 status:

- `CMV2-07`: `GREEN`
- `CMV2-08`: `GREEN`
- `CMV2-09`: `GREEN`
- `CMV2-10`: `GREEN`

## 3. Scope items

### 3.1 PM-P6-01 Planet preview payload parity

DoD:

1. Preview payload schema is explicit and versioned (`phase`, `corrosion_level`, `crack_intensity`, `pulse_factor`, `emissive_boost`).
2. FE mapping path is BE-authoritative and drift-protected.
3. Freeze gate catches key removal/rename/type drift.

Gate:

- `tests/test_api_integration.py::test_star_core_planet_physics_endpoint_returns_runtime_shape` (interim BE runtime-shape coverage)
- `frontend/src/components/universe/planetPhysicsParity.test.js`
- `tests/test_api_integration.py::test_planet_preview_payload_parity_v1` (dedicated BE parity gate)
- `CMV2-02`

### 3.2 PM-P6-02 Moon orbit readability

DoD:

1. Moon layout remains deterministic for high moon count.
2. Orbit bands stay visually separable from planet core and from each other.
3. Physics phase transitions preserve readability of moon preview nodes.

Gate:

- `frontend/src/lib/hierarchy_layout.test.js`
- `frontend/src/components/universe/scene/physicsSystem.test.js`

### 3.3 PM-P6-03 Preview convergence lifecycle

DoD:

1. Create/mutate/extinguish civilization lifecycle is reflected in preview state.
2. Replay and live path produce equivalent preview output.
3. Convergence gate fails on preview drift.

Gate:

- `tests/test_api_integration.py::test_release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence` (interim lifecycle convergence coverage)
- `frontend/src/components/universe/projectionConvergenceGate.test.js`
- `tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1` (dedicated BE preview-lifecycle gate)
- `CMV2-01`
- `CMV2-08`

### 3.4 PM-P6-04 Browser smoke

DoD:

1. Real browser smoke validates first planet, moon lifecycle writes, and preview update.
2. Smoke is runnable as standalone script gate for staging.
3. Failures provide actionable traces for preview-layer regressions.

Gate:

- `frontend/e2e/staging/planet-moon-preview.smoke.spec.mjs`
- `npm --prefix frontend run test:e2e:planet-moon-preview`
- `./scripts/staging_planet_moon_preview_smoke.sh`

### 3.5 PM-P6-05 Camera choreography determinism

DoD:

1. Camera transitions (`star focus`, `planet focus`, `grid open/close`) are deterministic and bounded.
2. Focus framing guarantees panel readability (no planet/panel collision).
3. Camera does not oscillate or over-correct under rapid state changes.

Gate:

- `frontend/src/components/universe/cameraPilotMath.test.js` (interim math-level guard)
- `frontend/src/components/universe/CameraPilot.test.jsx`
- `frontend/e2e/staging/camera-focus-flow.smoke.spec.mjs`
- `npm --prefix frontend run test:e2e:camera-focus-flow`
- `./scripts/staging_camera_focus_flow_smoke.sh`

### 3.6 PM-P6-06 Causal guidance closure

DoD:

1. Every preview phase has explicit `what changed`, `why`, `next action`.
2. Guidance is synchronized with runtime state, not static copy.
3. Contract violation and repair hints are linked to affected planet/moon in-context.

Gate:

- `frontend/src/components/universe/workspaceContractExplainability.test.js`
- `frontend/src/components/universe/planetBuilderFlow.test.js`
- `CMV2-03`

### 3.7 PM-P6-07 Interaction fail-safe

DoD:

1. Overlay stacking never blocks required actions unexpectedly.
2. Drag/drop and setup clicks are resilient on small viewport and zoomed layouts.
3. Recover CTA always returns user to nearest valid step.

Gate:

- `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs`
- `frontend/src/components/universe/planetBuilderWizardPanel.component.test.jsx`
- `CMV2-07`

### 3.8 PM-P6-08 Accessibility + reduced motion

DoD:

1. Preview layer is keyboard-navigable for core actions.
2. Reduced-motion mode keeps semantic feedback while removing heavy animation.
3. Contrast thresholds for critical states are test-guarded.

Gate:

- `frontend/src/components/universe/accessibilityPreview.test.jsx`
- `frontend/e2e/staging/accessibility-preview.smoke.spec.mjs`

### 3.9 PM-P6-09 Performance envelope

DoD:

1. Preview frame-time budget is defined and monitored under representative load.
2. High moon-count scenarios keep UI responsive and avoid frame collapse.
3. Performance regressions are surfaced as gate failures, not manual observations.

Gate:

- `frontend/src/components/universe/scene/performanceBudget.test.js`
- `frontend/e2e/staging/preview-performance.smoke.spec.mjs`

### 3.10 PM-P6-10 Workspace continuity

DoD:

1. Returning to workspace restores selected planet, grid state, and builder stage consistently.
2. No stale persisted state can force invalid preview transitions.
3. Resume flow preserves Star lock and preview semantics.

Gate:

- `frontend/src/components/universe/workspaceUiPersistence.test.js`
- `frontend/e2e/staging/workspace-resume-preview.smoke.spec.mjs`
- `npm --prefix frontend run test:e2e:workspace-resume-preview`
- `./scripts/staging_workspace_resume_preview_smoke.sh`
- `CMV2-07`
- `CMV2-10`

## 4. Exit criteria

1. `PM-P6-01` .. `PM-P6-10` are green.
2. Preview layer is deterministic across live and replay modes.
3. UX interaction layer is resilient across viewport/overlay/accessibility variants.
4. Planet+Moon preview closure can be marked in `docs/contracts/planet-moon-dod-v3.md`.
5. Logical-flow readiness and closure (`SG-LF-*`, `LF-*`) are synchronized from `docs/contracts/planet-civilization-logical-flow-dod-v1.md`.

## 5. Canonical TODO list (keep P6 open until all checked)

Order is strict: blockers -> partial closure -> final closure update.

### 5.1 Blockers (`OPEN` -> `PARTIAL`/`GREEN`)

- [x] `PM-P6-05A` (FE): added `frontend/src/components/universe/CameraPilot.test.jsx` for focus transition determinism and rapid state-change stability.
- [x] `PM-P6-05B` (FE): added `frontend/e2e/staging/camera-focus-flow.smoke.spec.mjs` + npm script + staging shell runner (`./scripts/staging_camera_focus_flow_smoke.sh`), staging run passing (`1 passed`, 2026-03-07).
- [x] `PM-P6-10A` (FE): added `frontend/e2e/staging/workspace-resume-preview.smoke.spec.mjs` + npm script + staging shell runner.

### 5.2 Partial closure (`PARTIAL` -> `GREEN`)

- [x] `PM-P6-01A` (BE): dedicated preview parity integration gate added: `tests/test_api_integration.py::test_planet_preview_payload_parity_v1`.
- [x] `PM-P6-03A` (BE): dedicated lifecycle convergence gate added: `tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1`.
- [x] `PM-P6-04A` (FE): executed `npm --prefix frontend run test:e2e:planet-moon-preview`; initial timeout observed, rerun passed (`1 passed`, 2026-03-06).
- [x] `PM-P6-07A` (FE): executed `npm --prefix frontend run test:e2e:workspace-starlock` (`1 passed`, 2026-03-06) for P6 interaction fail-safe evidence.
- [x] `PM-P6-08A` (FE): executed `npm --prefix frontend run test:e2e:accessibility-preview` (`1 passed`, 2026-03-06).
- [x] `PM-P6-09A` (FE): executed `npm --prefix frontend run test:e2e:preview-performance` (`1 passed`, 2026-03-06).
- [x] `CMV2-08A` (FE+BE): dedicated scenario gate added for mineral edit -> mutate -> facts convergence:
      `tests/test_api_integration.py::test_civilization_mineral_edit_mutate_facts_convergence_v1`
  - FE guard `frontend/src/lib/civilizationRuntimeRouteGate.test.js`.
- [x] `PM-P6-10B` (FE): `npm --prefix frontend run test:e2e:workspace-resume-preview` is now passing (`1 passed`, 2026-03-07) after resume-flow fixes.

### 5.3 Final closure updates (docs + gate hygiene)

- [ ] `PM-P6-DOC-01`: update `Current state` in this file so all `PM-P6-*` are `GREEN`.
- [ ] `PM-P6-DOC-02`: update P6 rows in `docs/contracts/planet-moon-dod-v3.md` test matrix to `GREEN`.
- [x] `PM-P6-DOC-03`: closure addendum added in `docs/release/v1-release-notes.md` with executed commands and pass results.
- [ ] `PM-P6-GATE-01`: run `pre-commit run` and ensure `frontend eslint` + `frontend prettier check` + targeted FE/BE gates pass before closure sign-off.
- [x] `PM-P6-BRANCH-01`: branch scope promote smoke gate added and passing:
      `frontend/e2e/staging/branch-scope-promote.smoke.spec.mjs`
  - `npm --prefix frontend run test:e2e -- e2e/staging/branch-scope-promote.smoke.spec.mjs` (`1 passed`, 2026-03-08).

### 5.4 CMV2 closure dependencies (must be closed with P6)

- [x] `CMV2-07A`: dedicated FE gate added for deterministic `planet select -> civilization grid open` behavior (`frontend/src/lib/civilizationWorkspaceSelectionGate.test.js`).
- [x] `CMV2-09A`: implemented mineral-level endpoint strategy (`/civilizations/{id}/minerals/{key}` + `/moons` alias) with integration gate `tests/test_api_integration.py::test_civilization_mineral_endpoint_patch_remove_and_health`.
- [x] `CMV2-10A`: added deterministic health derivation gate from mineral violations (`ACTIVE/WARNING/ANOMALY/ARCHIVED`) in `tests/test_moon_contracts.py::test_derive_civilization_health_flags_anomaly_on_invalid_facts`.

## 6. Execution order (implementation waves)

### 6.1 Wave 1 - logic blockers first

Scope:

- `PM-P6-05A`, `PM-P6-05B`
- `PM-P6-10A`
- `CMV2-07A`

Exit checks:

- camera-focus component and staging smoke gates exist and pass locally where possible.
- workspace resume preview staging smoke gate exists.
- explicit FE gate exists for deterministic `planet select -> civilization grid open`.

### 6.2 Wave 2 - convergence + parity closure

Scope:

- `PM-P6-01A`
- `PM-P6-03A`
- `CMV2-08A`

Exit checks:

- dedicated BE parity and lifecycle gates are implemented and green.
- dedicated mineral edit convergence scenario is green.
- civilization health derivation gate stays green and deterministic under replay.

### 6.3 Wave 3 - staging evidence + contract decision

Scope:

- `PM-P6-04A`, `PM-P6-07A`, `PM-P6-08A`, `PM-P6-09A`
- docs closure (`PM-P6-DOC-01`, `PM-P6-DOC-02`, `PM-P6-DOC-03`, `PM-P6-GATE-01`)

Exit checks:

- staging commands are executed and evidence is attached in release notes.
- `CMV2-09` is resolved (implemented endpoint + gate OR explicit reject+replacement gate, documented).
- P6 and CMV2 statuses are synchronized to final truth in backlog + DoD + release notes.

## 7. Logical flow extension (open)

Canonical source:

- `docs/contracts/planet-civilization-logical-flow-dod-v1.md`
- `docs/contracts/planet-civilization-logical-flow-wave0-execution-v1.md`

Current status:

- `SG-LF-04`: `GREEN` (canonical route policy freeze done 2026-03-07)
- `SG-LF-05`: `GREEN` (error envelope freeze + FE mapping closure done 2026-03-07)
- `SG-LF-06`: `GREEN` (Visual Builder context contract freeze done 2026-03-07)
- `SG-LF-07`: `GREEN` (Bond validate/preview contract + reject taxonomy freeze done 2026-03-07)
- `SG-LF-08`: `GREEN` (Moon-impact query contract freeze done 2026-03-07)
- `SG-LF-09`: `GREEN` (Visual Builder state machine contract freeze done 2026-03-07)
- `SG-LF-10`: `GREEN` (Inspector IA contract freeze done 2026-03-07)
- `SG-LF-11`: `GREEN` (Persistence scope + resume safety contract freeze done 2026-03-07)
- `SG-LF-12`: `GREEN` (Feature-flag rollout plan freeze done 2026-03-07)
- `SG-LF-13`: `GREEN` (Test matrix now executable in BE + FE + staging inventory path)
- `SG-LF-14`: `GREEN` (Deterministic two-planet fixtures done 2026-03-07)
- `SG-LF-15`: `GREEN` (Telemetry schema freeze done 2026-03-07)
- `SG-LF-16`: `GREEN` (Rollback policy freeze done 2026-03-07)
- `SG-LF-01`: `GREEN` (Vocabulary freeze approved 2026-03-07; `docs/contracts/planet-civilization-glossary-v1.md`)
- `SG-LF-02`: `GREEN` (UX intent freeze approved 2026-03-07; `docs/contracts/planet-civilization-ux-intent-v1.md`)
- `SG-LF-03`: `GREEN` (Success metrics freeze approved 2026-03-07; `LF-M01..LF-M06` thresholds in `docs/contracts/planet-civilization-ux-intent-v1.md`)
- `LF-01` .. `LF-08`: `PARTIAL` (BE + FE + staging smoke inventory are executable; full closure evidence is still open).

TODO synchronization:

- [x] `PM-P6-LF-01`: synchronize readiness status (`SG-LF-01` .. `SG-LF-16`) into this backlog snapshot (full sync complete on 2026-03-07; all `SG-LF-01..16` are `GREEN`).
- [x] `PM-P6-LF-02`: add FE gate inventory for `LF-01` .. `LF-05`.
  - Evidence: `frontend/src/components/universe/planetCivilizationMatrix.placeholder.test.js` now contains executable `LF-01..LF-08` assertions (no `it.skip` placeholders).
- [x] `PM-P6-LF-03`: add BE gate inventory for `LF-04`, `LF-06`, `LF-07`.
  - Evidence: `tests/test_planet_civilization_lf_matrix_placeholder.py` now contains executable LF-01..LF-08 integration assertions.
- [x] `PM-P6-LF-04`: add staging smoke inventory for moon-inspection, mineral-repair, cross-planet-preview flows.
  - Evidence: `frontend/e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` now runs real browser flow (workspace bootstrap + grid + command bar), not static inventory mapping only.
- [ ] `PM-P6-LF-05`: closure update in this file after all `SG-LF-*` and `LF-*` are green.
