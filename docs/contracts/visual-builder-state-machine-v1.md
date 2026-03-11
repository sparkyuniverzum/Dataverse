# Visual Builder State Machine v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: FE architecture
Depends on: `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/planet-builder-mvp-v2.md`, `frontend/src/components/universe/planetBuilderFlow.js`

## 1. Purpose

Define one canonical state machine for workspace interaction logic:
1. navigation focus (planet/moon/civilization),
2. bond draft and preview flow,
3. planet-builder mission flow,
4. deterministic recover behavior.

## 2. Canonical input contract

State resolution is driven only by:
1. `WorkspaceContextV1` envelope,
2. user intent events,
3. local UI persistence (`selected_table_id`, `selected_asteroid_id`, `quick_grid_open`).

No direct component state may bypass this machine.

## 3. State groups

### 3.1 Navigation states

1. `NAV_UNIVERSE`: no active planet focus.
2. `NAV_PLANET_FOCUSED`: selected planet active.
3. `NAV_MOON_FOCUSED`: selected moon active.
4. `NAV_CIVILIZATION_FOCUSED`: selected civilization active.
5. `NAV_GRID_OPEN`: quick grid open for selected planet.

### 3.2 Bond flow states

1. `BOND_IDLE`: no draft.
2. `BOND_DRAFT_SOURCE`: source selected.
3. `BOND_DRAFT_TARGET`: source + target selected.
4. `BOND_PREVIEW`: validate payload received (`ALLOW|WARN|REJECT`).
5. `BOND_BLOCKED`: preview returned blocking reasons.
6. `BOND_COMMITTING`: write in progress.
7. `BOND_COMMITTED`: write converged.

### 3.3 Planet-builder flow states (existing contract surface)

1. `StarLockedRequired`
2. `BlueprintOpen`
3. `DraggingPlanet`
4. `PlanetPlaced`
5. `CameraSettled`
6. `BuilderOpen`
7. `CapabilityAssembling`
8. `PreviewReady`
9. `Committing`
10. `Converged`
11. `ErrorRecoverable`

These states stay source-compatible with `planetBuilderFlow.js`.

### 3.4 Terminal/control states

1. `SYNCING`: context refresh in progress.
2. `ERROR_RECOVERABLE`: operation-level recover path available.
3. `ERROR_BLOCKING`: explicit user intervention required.

## 4. Event contract

Required events:
1. `select_planet`
2. `select_moon`
3. `select_civilization`
4. `open_grid`
5. `close_grid`
6. `start_bond_draft`
7. `select_bond_target`
8. `request_bond_preview`
9. `confirm_bond_commit`
10. `cancel_bond_draft`
11. `builder_action` (delegates to existing planet-builder action set)
12. `runtime_refresh`
13. `recover_error`

## 5. Guard rules

1. `select_moon` requires `NAV_PLANET_FOCUSED`.
2. `select_civilization` requires active planet scope.
3. `open_grid` requires selected planet and unlocked interaction.
4. `request_bond_preview` requires source+target and normalized type.
5. `confirm_bond_commit` requires preview decision `ALLOW|WARN` and `blocking=false`.
6. Any mutation event during `SYNCING` is queued or rejected deterministically.
7. Builder commit requires `schema_complete=true` and `star_locked=true`.

## 6. Transition matrix (minimum deterministic paths)

1. `NAV_UNIVERSE + select_planet -> NAV_PLANET_FOCUSED`
2. `NAV_PLANET_FOCUSED + select_moon -> NAV_MOON_FOCUSED`
3. `NAV_PLANET_FOCUSED + open_grid -> NAV_GRID_OPEN`
4. `NAV_GRID_OPEN + close_grid -> NAV_PLANET_FOCUSED`
5. `BOND_IDLE + start_bond_draft -> BOND_DRAFT_SOURCE`
6. `BOND_DRAFT_SOURCE + select_bond_target -> BOND_DRAFT_TARGET`
7. `BOND_DRAFT_TARGET + request_bond_preview -> BOND_PREVIEW`
8. `BOND_PREVIEW + decision=REJECT -> BOND_BLOCKED`
9. `BOND_PREVIEW + decision=ALLOW|WARN + confirm_bond_commit -> BOND_COMMITTING`
10. `BOND_COMMITTING + runtime_refresh(converged) -> BOND_COMMITTED`

Invalid transition behavior:
1. No write side effect.
2. Return machine-readable reason.
3. If recoverable, expose `recovery_state`.

## 7. Priority rules for state resolution

Resolution order (highest first):
1. `ERROR_BLOCKING`
2. `ERROR_RECOVERABLE`
3. `SYNCING`
4. `BOND_*` in-progress states
5. `Planet Builder` states
6. `Navigation` states

This prevents ambiguous UI when multiple flags are active.

## 8. Recovery contract

1. `ERROR_RECOVERABLE` stores `last_valid_state`.
2. `recover_error` restores `last_valid_state` if still valid.
3. If stored state is invalid, fallback to:
   - `NAV_PLANET_FOCUSED` when selected planet exists,
   - otherwise `NAV_UNIVERSE`.
4. Recover action must clear stale draft tokens (`bond draft`, `mutation pending`).

## 9. Persistence contract

Persisted keys:
1. `selected_table_id`
2. `selected_asteroid_id`
3. `quick_grid_open`
4. `builder_last_valid_state`

Do not persist:
1. live preview result payload,
2. pending mutation requests,
3. stale bond draft with missing endpoints.

## 10. DoD for this contract

1. Contract is approved and linked from Wave 0 plan (`W0-LF-09`).
2. Existing planet-builder machine remains source-compatible.
3. FE tests validate guards for bond preview gating and recover semantics.
