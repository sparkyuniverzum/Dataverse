# Planet/Civilization Feature Flag Rollout v1

Status: active
Date: 2026-03-07
Owner: FE + Release
Depends on: `docs/contracts/visual-builder-state-machine-v1.md`, `docs/contracts/inspector-ia-contract-v1.md`, `docs/release/v1-rollout-runbook.md`

## 1. Purpose

Define safe progressive rollout for new logical-flow capabilities without forcing full-coupled release.

## 2. Flags

Required flags:
1. `moon_discovery_v1`
2. `bond_builder_v1`
3. `cross_planet_guard_v1`

Default in production:
1. `moon_discovery_v1=false`
2. `bond_builder_v1=false`
3. `cross_planet_guard_v1=false`

## 3. Rollout phases

1. `phase-0` (internal): all flags enabled only for internal test cohort.
2. `phase-1` (limited): `moon_discovery_v1=true` for 10% traffic.
3. `phase-2` (expanded): `moon_discovery_v1=true`, `bond_builder_v1=true` for 25% traffic.
4. `phase-3` (guarded cross-planet): enable `cross_planet_guard_v1` for selected workspaces.
5. `phase-4` (general): all flags enabled by default after stability window.

## 4. Promotion gates

Promotion to next phase requires:
1. no P1 incidents in last 24h,
2. error-rate increase under 2% baseline,
3. no unresolved blocking regression in bond preview or moon inspection flows,
4. rollback drill verified in previous phase.

## 5. Rollback matrix

1. Moon discoverability issue -> disable `moon_discovery_v1`.
2. Bond draft/preview issue -> disable `bond_builder_v1`.
3. Cross-planet policy issue -> disable `cross_planet_guard_v1`.
4. Multi-flag instability -> disable all three and return to last stable phase.

Rollback SLO:
1. flag rollback execution <= 10 minutes,
2. user-facing incident note <= 20 minutes.

## 6. Telemetry checkpoints

Required counters:
1. `moon_opened`
2. `bond_preview_allowed`
3. `bond_preview_rejected`
4. `cross_planet_blocked`

Required monitoring dimensions:
1. `galaxy_id`
2. `branch_id`
3. `flag_phase`
4. `client_version`

## 7. Operational ownership

1. Release owner: executes phase promotion/rollback.
2. FE owner: validates UI regressions.
3. BE owner: validates validate/impact endpoint stability.
4. QA owner: executes smoke checklist for each phase.

## 8. DoD for rollout plan

1. Flags and defaults are documented and approved.
2. Phase progression and rollback matrix are documented.
3. Runbook references this document for incident-time action.
