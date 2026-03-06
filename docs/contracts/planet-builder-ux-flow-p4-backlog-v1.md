# Planet Builder UX Flow P4 Backlog v1

Status: closed
Date: 2026-03-06
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/planet-builder-ux-flow-p3-backlog-v1.md`

## 1. Goal

Add realistic interactive validation over Planet Builder wizard behavior.
Unlike pure contract/unit tests, this layer validates user-action sequences with blocked transitions and recover paths.

## 2. Priority order

1. `PM-P4-01` Interactive wizard harness (mission + guards + recover).
2. `PM-P4-02` Component-level harness with UI event simulation.
3. `PM-P4-03` Browser e2e smoke (staging profile).

Current state:
- `PM-P4-01`: closed.
- `PM-P4-02`: closed (component-level harness with jsdom + real click events).
- `PM-P4-03`: closed (Playwright browser smoke on staging-like route).

## 3. Scope items

### 3.1 PM-P4-01 Interactive wizard harness

DoD:
1. Harness models user actions (lock/open/drag/drop/setup/preset/assemble/commit/recover).
2. Mission path `StarLockedRequired -> ... -> Converged` is test-gated.
3. Invalid transitions and error-recover behavior are test-gated.

Gate:
- `frontend/src/components/universe/planetBuilderWizardHarness.test.js`

### 3.2 PM-P4-02 Component-level harness

DoD:
1. Component harness verifies visible UI reactions to wizard actions.
2. Assertions cover action buttons, guidance copy, and recover CTA behavior.
3. Integrated into FE gate pack.

Gate:
- `frontend/src/components/universe/planetBuilderWizardPanel.component.test.jsx`

### 3.3 PM-P4-03 Browser e2e smoke

DoD:
1. One browser smoke scenario on staging profile passes.
2. Scenario validates first-planet wizard through commit + grid convergence.
3. Smoke is executable in CI/staging gate.

Gate:
- `frontend/e2e/planet-builder-wizard-smoke.spec.mjs`

## 4. Closure

P4 closure completed on 2026-03-06.
All `PM-P4-*` items are green and wired into CI/gate scripts.
