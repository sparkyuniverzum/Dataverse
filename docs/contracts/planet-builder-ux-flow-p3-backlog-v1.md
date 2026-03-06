# Planet Builder UX Flow P3 Backlog v1

Status: active
Date: 2026-03-06
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/planet-builder-mvp-v2.md`

## 1. Goal

Harden first-planet builder UX so user never loses context between:
- star law lock,
- planet placement,
- schema lego assembly,
- commit and convergence.

This backlog is FE-first and preserves existing BE contract boundaries.

## 2. Priority order

1. `PM-P3-01` Canonical builder state machine + causal guidance copy.
2. `PM-P3-02` Deterministic transition guards (invalid transitions blocked).
3. `PM-P3-03` End-to-end FE scenario gate (`StarLockedRequired -> Converged`).

Current state:
- `PM-P3-01`: closed (state machine + guidance copy + freeze test).
- `PM-P3-02`: closed (transition guards + recover-to-last-valid semantics).
- `PM-P3-03`: closed (deterministic FE mission scenario from lock gate to convergence).

## 3. Scope items

### 3.1 PM-P3-01 Canonical state machine + guidance

DoD:
1. One resolver maps runtime flags to builder state.
2. Each state has deterministic "why" and "next action" text.
3. Contract gate exists and is green.

Gate:
- `frontend/src/components/universe/planetBuilderFlow.test.js`

### 3.2 PM-P3-02 Transition guards

DoD:
1. FE blocks illegal transitions (e.g. commit without preview).
2. Error recovery returns to previous valid state, not reset.
3. Guard behavior is test-gated.

Gate:
- `frontend/src/components/universe/planetBuilderFlow.test.js`

### 3.3 PM-P3-03 FE e2e-like mission scenario

DoD:
1. One scripted FE scenario covers full first-planet mission.
2. Scenario validates state sequence and convergence signal.
3. Included in CI gate pack.

Gate:
- `frontend/src/components/universe/planetBuilderMissionFlow.test.js`

## 4. Exit criteria

1. `PM-P3-01` .. `PM-P3-03` are green.
2. Planet Builder mission state is always visible in workspace.
3. No ambiguous step without explicit next action.
