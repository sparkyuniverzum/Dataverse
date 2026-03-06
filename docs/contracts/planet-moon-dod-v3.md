# Planet + Moon DoD v3

Status: active (planet/moon preview layer not closed)
Date: 2026-03-06
Owner: Core BE/FE architecture
Depends on: `docs/contracts/planet-builder-mvp-v2.md`, `docs/contracts/moon-contract-v1.md`, `docs/contracts/civilization-contract-v1.md`, `docs/contracts/mineral-contract-v1.md`, `docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`

## 1. Purpose

Define strict post-MVP Definition of Done for the strategic layer:
- Planet (table data carrier),
- Moon (capability module),
- Civilization (row lifecycle),
- Mineral (typed field value).

This document converts architecture intent into execution priorities and machine-verifiable gates.

## 2. Canonical ontology (non-negotiable)

1. Galaxy = workspace tenant boundary.
2. Star = constitution + physical law authority.
3. Planet = table aggregate and data carrier.
4. Moon = capability module attached to planet contract.
5. Civilization = row instance.
6. Mineral = typed value inside civilization.

Invariant: `Moon capability != Civilization row`.

## 3. Priority buckets

## 3.1 P0 (release blocking for Planet Builder v1)

### P0.1 Moon first-class capability entity

Goal:
- capability state is no longer only implicit in `TableContract` payload.

DoD:
1. Dedicated capability aggregate exists (persistent identity + versioning + audit trail).
2. Capability lifecycle supports create/update/deprecate.
3. Planet contract projection and capability aggregate remain deterministic and converged.

Acceptance checks:
1. Capability create/update changes validation/projection behavior in same refresh cycle.
2. Capability rollback restores previous behavior without residual drift.

### P0.2 Deterministic capability composition

Goal:
- combining multiple capability modules always yields deterministic execution.

DoD:
1. Explicit composition order is defined and versioned.
2. Conflict policy is explicit (`fail_fast` or deterministic precedence).
3. Same input timeline always yields same rule evaluation output.

Acceptance checks:
1. Conflict scenario returns machine-readable conflict reason.
2. Replayed event stream reproduces identical effective rule graph.

### P0.3 Contract evolution over existing civilizations

Goal:
- capability/contract changes over live data are operationally safe.

DoD:
1. Evolution modes are explicit (`revalidate`, `backfill`, `mark_invalid`, `retryable`).
2. Existing civilizations are processed without partial hidden failures.
3. OCC/idempotency semantics are preserved during migration writes.

Acceptance checks:
1. Post-evolution writes follow new contract immediately.
2. Invalid pre-existing rows are explicitly surfaced in projection.

### P0.4 Validation explainability (operator-grade)

Goal:
- every contract failure is explainable and actionable.

DoD:
1. Error payload exposes rule id, capability id, mineral key, and failing value.
2. FE can render deterministic “why this failed” diagnostics.
3. No generic `422` without structured reason for contract failures.

Acceptance checks:
1. Integration tests assert structured error envelope fields.
2. FE tests assert diagnostic rendering path.

### P0.5 Bridge Moon integrity governance

Goal:
- cross-planet relations preserve integrity under lifecycle operations.

DoD:
1. Referential rules are explicit (source/target existence, orphan policy).
2. Soft-delete propagation policy is explicit across bridges.
3. Bridge flow remains convergence-safe for snapshot/tables/grid/3D.

Acceptance checks:
1. Cross-planet extinguish/mutate scenarios preserve relation integrity.
2. No dangling references after replay.

## 3.2 P1 (hardening after P0 closure)

Execution backlog: `docs/contracts/planet-moon-p1-backlog-v1.md`

### P1.1 Runtime naming closure (`/civilizations*` canonical)

DoD:
1. FE runtime uses `/civilizations*` as primary everywhere.
2. `/moons*` is compatibility-only with explicit deprecation markers.
3. Route inventory freeze covers both surfaces during migration window.

### P1.2 Capability compatibility matrix

DoD:
1. Allowed and forbidden capability combinations are explicit.
2. Forbidden combos fail deterministically before commit.
3. Matrix is test-gated and versioned.

### P1.3 Planet visual-law parity (BE -> FE)

DoD:
1. Physical metrics (`size`, `luminosity`, `corrosion`, `phase`) are BE-authoritative.
2. FE only maps authoritative metrics to rendering.
3. Parity tests prevent FE-side semantic drift.

## 3.3 P2 (scale, operations, and repair ergonomics)

### P2.1 Bulk + replay resilience

DoD:
1. Bulk writes preserve OCC/idempotency guarantees.
2. Replay convergence remains green under high event volume.

### P2.2 Capability observability dashboard

DoD:
1. Runtime exposes rule-failure rates, drift trend, and validation latency.
2. Alertable SLOs exist for capability evaluation path.

### P2.3 Guided repair flows

DoD:
1. FE offers deterministic repair suggestions for known contract violations.
2. Repair actions remain idempotent and auditable.

P2 closure record (2026-03-06):
1. `PM-P2-01` is GREEN.
2. `PM-P2-02` is GREEN.
3. `PM-P2-03` is GREEN.

## 3.4 P3 (Planet Builder UX flow hardening)

### P3.1 Deterministic builder state machine + causal guidance

DoD:
1. FE resolves one canonical builder state from runtime flags.
2. Every active builder state has explicit "why" + "next action" copy.
3. Recoverable errors keep user in the nearest valid builder step.

## 3.5 P4 (Interactive wizard harness)

### P4.1 Interactive wizard e2e harness

DoD:
1. FE has interactive wizard harness that simulates real user actions step-by-step.
2. Harness validates blocked transitions and recover semantics under error.
3. Harness gate is included in CI and release gate pack.

## 3.6 P5 (Real auth/session staging flow)

### P5.1 Auth bootstrap for browser smoke

DoD:
1. Browser smoke prepares deterministic real user credentials.
2. Bootstrap works for both first run (register) and rerun (login fallback).
3. Helper is reusable across staging smoke specs.

### P5.2 Real auth/session lifecycle smoke

DoD:
1. Browser smoke covers `login -> me -> refresh -> logout` on real app route.
2. Session token lifecycle is verified through real API responses.
3. Logout clears local session tokens in browser.

### P5.3 Real workspace bootstrap smoke

DoD:
1. Browser smoke covers first-run and rerun workspace entry paths.
2. Galaxy create/select/enter transition is deterministic for staging runs.
3. Smoke uses real API and real app route (no harness route).

### P5.4 Real star-lock -> first-planet -> grid convergence smoke

DoD:
1. Browser smoke covers `star lock -> first planet placement -> setup -> commit`.
2. Grid convergence is asserted via real runtime projection after commit.
3. Smoke is scriptable as a staging release gate.

## 3.7 P6 (Planet/Moon preview layer closure)

Execution backlog: `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`

### P6.1 Planet preview payload parity

DoD:
1. Planet preview payload shape is explicit and versioned (phase, corrosion, crack, pulse, emissive).
2. FE rendering uses BE-authoritative preview metrics without semantic drift.
3. Contract freeze gate fails on missing/renamed preview keys.

### P6.2 Moon preview and orbit readability

DoD:
1. Moon preview nodes are deterministic for create/mutate/extinguish lifecycle.
2. Orbit layout is stable for high moon counts and avoids overlap with planet core.
3. Preview remains legible in both idle and high-load phases.

### P6.3 Planet/Moon preview convergence

DoD:
1. Grid civilization changes converge to 3D planet/moon preview in bounded time.
2. Replay path preserves the same preview state as live path.
3. Browser smoke validates first-planet + moon lifecycle preview updates.

### P6.4 Camera choreography determinism

DoD:
1. Camera focus transitions are deterministic across star/planet/grid pivots.
2. Camera framing preserves setup panel readability.
3. Rapid state changes do not break focus target stability.

### P6.5 In-context causal guidance

DoD:
1. Preview states expose `what changed`, `why`, and `next action`.
2. Guidance is runtime-driven and synchronized with active state.
3. Repair/violation hints remain mapped to affected preview entities.

### P6.6 Interaction fail-safe

DoD:
1. Overlay stacking does not block required actions unexpectedly.
2. Small viewport interactions remain operable for DnD and setup controls.
3. Recover action always returns to nearest valid mission step.

### P6.7 Accessibility + reduced-motion parity

DoD:
1. Core preview actions are keyboard reachable.
2. Reduced-motion mode preserves semantic feedback.
3. Critical-state contrast/readability is test-gated.

### P6.8 Performance envelope

DoD:
1. Preview layer has explicit frame-time budget and load profile.
2. High moon-count scenarios stay responsive.
3. Regressions are surfaced through automated gate failures.

### P6.9 Workspace resume continuity

DoD:
1. Planet/grid/builder context restores deterministically after refresh/reopen.
2. Persisted UI state cannot force invalid preview transitions.
3. Resume path preserves Star lock semantics.

### P6.10 Comprehensive browser smoke coverage

DoD:
1. Preview-layer smoke covers payload parity, interaction, and convergence semantics together.
2. Smoke is script-gated for staging/release profile.
3. Failures provide actionable traces for camera/preview/interactions.

## 4. Test matrix (required gates)

Legend:
- `GREEN`: gate is covered and validated in current automation snapshot.
- `PARTIAL`: gate coverage exists but closure evidence is incomplete.
- `OPEN`: required gate artifact is missing and must be added.

| ID | Priority | Scope | Gate type | Status | Target test / command |
|---|---|---|---|---|---|
| PM-P0-01 | P0 | Moon first-class capability entity | BE integration | GREEN | `tests/test_api_integration.py::test_moon_capability_entity_lifecycle_and_projection_convergence` |
| PM-P0-02 | P0 | Deterministic capability composition | BE machine + integration | GREEN | `tests/test_moon_contracts.py::test_capability_composition_order_and_conflict_policy` |
| PM-P0-03 | P0 | Contract evolution on existing civilizations | BE integration | GREEN | `tests/test_api_integration.py::test_contract_evolution_revalidate_backfill_mark_invalid` |
| PM-P0-04 | P0 | Validation explainability payload | BE integration | GREEN | `tests/test_api_integration.py::test_contract_violation_explainability_payload_shape` |
| PM-P0-05 | P0 | Explainability rendering | FE gate | GREEN | `frontend/src/components/universe/workspaceContractExplainability.test.js` |
| PM-P0-06 | P0 | Bridge Moon integrity | BE integration | GREEN | `tests/test_api_integration.py::test_bridge_integrity_soft_delete_and_replay_convergence` |
| PM-P0-07 | P0 | E2E convergence baseline | BE integration | GREEN | `pytest -q tests/test_api_integration.py -k "release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence"` |
| PM-P0-08 | P0 | FE replay convergence | FE gate | GREEN | `cd frontend && npm test -- --run src/components/universe/projectionConvergenceGate.test.js` |
| PM-P1-01 | P1 | `/civilizations*` canonical runtime | FE contract gate | GREEN | `frontend/src/lib/civilizationRuntimeRouteGate.test.js` |
| PM-P1-02 | P1 | `/moons*` compatibility window | BE+FE contract | GREEN | `tests/test_api_integration.py::test_moons_alias_deprecation_marker_and_parity` + FE route inventory gate |
| PM-P1-03 | P1 | Capability compatibility matrix | BE machine gate | GREEN | `tests/test_moon_contract_freeze_gate.py::test_capability_matrix_freeze_v1` |
| PM-P1-04 | P1 | Planet visual-law parity | FE gate | GREEN | `frontend/src/components/universe/planetPhysicsParity.test.js` |
| PM-P2-01 | P2 | Bulk write resilience | BE integration | GREEN | `tests/test_api_integration.py::test_bulk_civilization_writes_occ_idempotency` |
| PM-P2-02 | P2 | Replay under load | BE+FE convergence | GREEN | `tests/test_universe_projection_errors.py::test_projection_replay_convergence_under_load` + FE replay gate |
| PM-P2-03 | P2 | Guided repair flow | FE e2e-like unit | GREEN | `frontend/src/components/universe/repairFlowContract.test.js` |
| PM-P3-01 | P3 | Planet Builder state machine + guidance | FE contract gate | GREEN | `frontend/src/components/universe/planetBuilderFlow.test.js` |
| PM-P3-02 | P3 | Planet Builder transition guards + recover | FE contract gate | GREEN | `frontend/src/components/universe/planetBuilderFlow.test.js` |
| PM-P3-03 | P3 | Planet Builder mission scenario (lock -> convergence) | FE e2e-like unit | GREEN | `frontend/src/components/universe/planetBuilderMissionFlow.test.js` |
| PM-P4-01 | P4 | Interactive wizard harness (mission + guards + recover) | FE e2e-like harness | GREEN | `frontend/src/components/universe/planetBuilderWizardHarness.test.js` |
| PM-P4-02 | P4 | Component-level wizard harness with real UI events | FE component harness | GREEN | `frontend/src/components/universe/planetBuilderWizardPanel.component.test.jsx` |
| PM-P4-03 | P4 | Browser smoke (Playwright) lock -> converged | FE browser e2e smoke | GREEN | `frontend/e2e/planet-builder-wizard-smoke.spec.mjs` |
| PM-P5-01 | P5 | Real auth bootstrap helper | FE staging e2e helper | GREEN | `frontend/e2e/staging/auth-bootstrap.mjs` |
| PM-P5-02 | P5 | Real auth/session lifecycle smoke | FE staging browser smoke | GREEN | `frontend/e2e/staging/auth-session-real.smoke.spec.mjs` |
| PM-P5-03 | P5 | Real workspace bootstrap smoke | FE staging browser smoke | GREEN | `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs` |
| PM-P5-04 | P5 | Real star-lock -> first planet -> grid convergence smoke | FE staging browser smoke + script gate | GREEN | `npm --prefix frontend run test:e2e:workspace-starlock` + `./scripts/staging_workspace_starlock_wizard_grid_smoke.sh` |
| PM-P6-01 | P6 | Planet preview payload parity | BE+FE contract gate | PARTIAL | `tests/test_api_integration.py::test_star_core_planet_physics_endpoint_returns_runtime_shape` + `frontend/src/components/universe/planetPhysicsParity.test.js` + `ADD: tests/test_api_integration.py::test_planet_preview_payload_parity_v1` |
| PM-P6-02 | P6 | Moon preview orbit readability | FE layout/physics gate | GREEN | `frontend/src/lib/hierarchy_layout.test.js` + `frontend/src/components/universe/scene/physicsSystem.test.js` |
| PM-P6-03 | P6 | Planet/Moon preview convergence under lifecycle | BE+FE convergence gate | PARTIAL | `tests/test_api_integration.py::test_release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence` + `frontend/src/components/universe/projectionConvergenceGate.test.js` + `ADD: tests/test_api_integration.py::test_planet_moon_preview_convergence_lifecycle_v1` |
| PM-P6-04 | P6 | Browser smoke for preview layer | FE staging browser smoke | PARTIAL | `frontend/e2e/staging/planet-moon-preview.smoke.spec.mjs` + `./scripts/staging_planet_moon_preview_smoke.sh` |
| PM-P6-05 | P6 | Camera choreography determinism | FE component + browser gate | OPEN | `frontend/src/components/universe/cameraPilotMath.test.js` + `ADD: frontend/src/components/universe/CameraPilot.test.jsx` + `ADD: frontend/e2e/staging/camera-focus-flow.smoke.spec.mjs` |
| PM-P6-06 | P6 | In-context causal guidance | FE contract gate | GREEN | `frontend/src/components/universe/planetBuilderFlow.test.js` + `frontend/src/components/universe/workspaceContractExplainability.test.js` |
| PM-P6-07 | P6 | Interaction fail-safe | FE component + browser gate | PARTIAL | `frontend/src/components/universe/planetBuilderWizardPanel.component.test.jsx` + `frontend/e2e/staging/workspace-starlock-wizard-grid.smoke.spec.mjs` |
| PM-P6-08 | P6 | Accessibility and reduced-motion parity | FE a11y contract + browser smoke | PARTIAL | `frontend/src/components/universe/accessibilityPreview.test.jsx` + `frontend/e2e/staging/accessibility-preview.smoke.spec.mjs` |
| PM-P6-09 | P6 | Preview performance envelope | FE perf gate + browser smoke | PARTIAL | `frontend/src/components/universe/scene/performanceBudget.test.js` + `frontend/e2e/staging/preview-performance.smoke.spec.mjs` |
| PM-P6-10 | P6 | Workspace resume continuity | FE persistence + browser smoke | OPEN | `frontend/src/components/universe/workspaceUiPersistence.test.js` + `ADD: frontend/e2e/staging/workspace-resume-preview.smoke.spec.mjs` |

## 5. Exit criteria by phase

### Planet+Moon v3 P0 closure

1. All `PM-P0-*` gates are green.
2. No non-explainable contract `422` remains in primary builder flow.
3. Replay convergence remains green after create/mutate/extinguish and bridge updates.

### Planet+Moon v3 P1 closure

1. Runtime canonical path is `/civilizations*` across FE write flows.
2. `/moons*` behavior is compatibility-only and explicitly marked.
3. Capability matrix freeze gate is green.

### Planet+Moon v3 P2 closure

1. Bulk/replay resilience gates are green.
2. Observability signals are available for on-call diagnosis.
3. Guided repair flows are deterministic and audited.

### Planet+Moon v3 P3 kickoff

1. Planet Builder runtime flow has canonical FE state machine gate.
2. Causal guidance copy is rendered for each active builder state.

### Planet+Moon v3 P3 progress

1. Transition guards block invalid builder actions by state.
2. Recover action returns to the last valid builder step.
3. FE mission scenario gate validates deterministic state sequence from star lock to convergence.

### Planet+Moon v3 P4 kickoff

1. Interactive wizard harness simulates real builder actions and validates outcomes end-to-end.
2. Component-level and browser-level smoke gates are green.

### Planet+Moon v3 P4 closure

1. Interactive harness (`PM-P4-01`) is green.
2. Component UI-event harness (`PM-P4-02`) is green.
3. Browser smoke (`PM-P4-03`) is green.

### Planet+Moon v3 P5 progress

1. Real auth bootstrap helper is in place for staging smoke runs.
2. Real auth/session browser smoke is implemented (`login -> me -> refresh -> logout`).
3. Real workspace bootstrap path is validated in browser smoke.
4. Real star-lock -> first planet -> grid convergence path is validated and script-gated.

### Planet+Moon v3 P6 kickoff (open)

1. Planet/Moon preview layer is not closed; preview parity/readability/convergence remain open.
2. Current normalized status: `PM-P6-02`, `PM-P6-06` are `GREEN`; `PM-P6-01`, `PM-P6-03`, `PM-P6-04`, `PM-P6-07`, `PM-P6-08`, `PM-P6-09` are `PARTIAL`; `PM-P6-05`, `PM-P6-10` are `OPEN`.

## 6. Out of scope for this document

1. Marketing copy and onboarding narrative text quality.
2. Visual art direction specifics (shader style, color themes).
3. Non-core module domains outside Planet/Moon/Civilization/Mineral runtime.
