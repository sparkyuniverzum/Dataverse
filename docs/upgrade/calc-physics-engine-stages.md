# Calc + Physics Engine Upgrade Stages

Status: in progress
Date: 2026-03-03

## Stage 1 - Calc foundation (implemented)
Goal:
- Separate deterministic computed outputs from user-entered domain facts.
- Keep event log as only write source of truth.

Deliverables:
- New read-model table `calc_state_rm` with:
  - scope keys: `user_id`, `galaxy_id`, `asteroid_id`
  - traceability: `source_event_seq`, `engine_version`
  - payload: `calculated_values`, `circular_fields_count`
  - lifecycle: `updated_at`, `deleted_at` (soft delete semantics)
- New service `CalcEngineService` to upsert calc projection deterministically.
- Read-model projector integration so calc projection is refreshed synchronously with rollups.

Definition of done:
- No domain write-path API behavior change.
- Calc outputs are persisted outside `atoms.metadata`.
- Projection replay remains deterministic for same event timeline.

## Stage 2 - Calc semantics hardening (next)
Goal:
- Make calc engine contract-driven and semantically strict.

Deliverables:
- Restrict cross-node aggregation to semantic `FLOW` edges (or explicit registry rule).
- Introduce typed number handling (`Decimal`) for financial-safe operations.
- Add formula execution plan from `formula_registry` (instead of free-form metadata scan only).
- Add deterministic error codes for formula evaluation failures.

Definition of done:
- Calc results no longer depend on non-flow edge noise.
- Typed numeric behavior is stable across locales and replay.

Status (2026-03-03):
- implemented
- calc aggregation is now FLOW-only in `CalcEngineService` (RELATION/TYPE/GUARDIAN ignored for cross-node math)
- formula execution is registry-first (`formula_registry`), metadata formulas used as fallback
- Decimal math is used internally for deterministic numeric aggregation
- deterministic calc error codes are emitted and stored (`calc_errors`, `error_count`) in `calc_state_rm`

## Stage 3 - Physics engine projection (implemented)
Goal:
- Move visual heuristics into a dedicated async projection.

Deliverables:
- New table `physics_state_rm` (visual-only fields: radius, emissive, pulse, stress, opacity, attraction).
- Async worker/service that reads `calc_state_rm` + V1 metrics and computes physics state.
- Engine versioning and idempotent projection updates.

Definition of done:
- Physics does not mutate business values.
- UI can render from `physics_state_rm` with graceful fallback.

Status (2026-03-03):
- implemented
- added `physics_state_rm` read-model with versioning (`engine_version`) and source traceability (`source_event_seq`)
- added `PhysicsEngineService` with deterministic/idempotent upsert projection for asteroid and bond visual factors
- integrated physics projection into `ReadModelProjector` rollup flow (sync projector mode; async worker extraction can reuse same service)
- stale physics records are soft-deleted (no hard-delete path)

## Stage 4 - UI runtime integration (next)
Goal:
- Use backend physics projection as primary render input.

Deliverables:
- `UniverseWorkspace` / layout layer consumes `physics_state_rm` payload.
- Fallback to local heuristics when physics payload is missing.
- Add visual regression + deterministic layout tests for hierarchy physics path.

Definition of done:
- Visual behavior is consistent across sessions and environments.
- Local-only heuristics are fallback, not source-of-truth.
