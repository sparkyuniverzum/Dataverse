# Planet+Moon Preview Layer P6 Backlog v1

Status: active
Date: 2026-03-06
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/star-physics-laws-v2.md`, `docs/contracts/planet-builder-mvp-v2.md`

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

Current state:
- `PM-P6-01`: open.
- `PM-P6-02`: open.
- `PM-P6-03`: open.
- `PM-P6-04`: open.
- `PM-P6-05`: open.
- `PM-P6-06`: open.
- `PM-P6-07`: open.
- `PM-P6-08`: open.
- `PM-P6-09`: open.
- `PM-P6-10`: open.

## 3. Scope items

### 3.1 PM-P6-01 Planet preview payload parity

DoD:
1. Preview payload schema is explicit and versioned (`phase`, `corrosion_level`, `crack_intensity`, `pulse_factor`, `emissive_boost`).
2. FE mapping path is BE-authoritative and drift-protected.
3. Freeze gate catches key removal/rename/type drift.

Gate:
- `tests/test_api_integration.py::test_planet_preview_payload_parity_v1`
- `frontend/src/components/universe/planetPhysicsParity.test.js`

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
- `tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1`
- `frontend/src/components/universe/projectionConvergenceGate.test.js`

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
- `frontend/src/components/universe/CameraPilot.test.jsx`
- `frontend/e2e/staging/camera-focus-flow.smoke.spec.mjs`

### 3.6 PM-P6-06 Causal guidance closure

DoD:
1. Every preview phase has explicit `what changed`, `why`, `next action`.
2. Guidance is synchronized with runtime state, not static copy.
3. Contract violation and repair hints are linked to affected planet/moon in-context.

Gate:
- `frontend/src/components/universe/workspaceContractExplainability.test.js`
- `frontend/src/components/universe/planetBuilderFlow.test.js`

### 3.7 PM-P6-07 Interaction fail-safe

DoD:
1. Overlay stacking never blocks required actions unexpectedly.
2. Drag/drop and setup clicks are resilient on small viewport and zoomed layouts.
3. Recover CTA always returns user to nearest valid step.

Gate:
- `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs`
- `frontend/src/components/universe/planetBuilderWizardPanel.component.test.jsx`

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

## 4. Exit criteria

1. `PM-P6-01` .. `PM-P6-10` are green.
2. Preview layer is deterministic across live and replay modes.
3. UX interaction layer is resilient across viewport/overlay/accessibility variants.
4. Planet+Moon preview closure can be marked in `docs/contracts/planet-moon-dod-v3.md`.
