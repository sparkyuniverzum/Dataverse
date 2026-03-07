# Planet/Civilization Telemetry Contract v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: FE + Analytics
Depends on: `docs/contracts/visual-builder-state-machine-v1.md`, `docs/contracts/inspector-ia-contract-v1.md`, `docs/release/planet-civilization-feature-flag-rollout-v1.md`

## 1. Purpose

Freeze telemetry schema for logical-flow rollout monitoring and operational decisions.

## 2. Event catalog (required)

1. `moon_opened`
2. `moon_rule_failed`
3. `bond_preview_allowed`
4. `bond_preview_rejected`
5. `bond_preview_warned`
6. `cross_planet_blocked`
7. `guided_repair_applied`
8. `guided_repair_failed`

## 3. Shared payload fields

All events must include:
1. `event_name`
2. `occurred_at`
3. `galaxy_id`
4. `branch_id` (nullable)
5. `planet_id` (nullable)
6. `civilization_id` (nullable)
7. `moon_id` (nullable)
8. `bond_id` (nullable)
9. `client_version`
10. `flag_phase`

## 4. Event-specific payload fields

`moon_rule_failed`:
1. `rule_id`
2. `capability_id`
3. `mineral_key`
4. `expected_constraint`

`bond_preview_rejected`:
1. `reject_codes[]`
2. `blocking_count`
3. `cross_planet`

`cross_planet_blocked`:
1. `source_planet_id`
2. `target_planet_id`
3. `reason_code`

`guided_repair_*`:
1. `strategy_key`
2. `repair_id`
3. `result` (`applied|failed`)

## 5. Sampling and retention

1. Critical reject/failure events: no sampling.
2. High-volume success events: optional 20% sample.
3. Retention target: 30 days for raw events, 180 days for aggregates.

## 6. Data quality rules

1. `event_name` must be from catalog.
2. IDs must be UUID strings when present.
3. `occurred_at` must be ISO datetime.
4. Unknown fields are ignored, not persisted in canonical aggregate.

## 7. DoD for telemetry contract

1. Event catalog and field inventory are approved.
2. Rollout plan references this telemetry contract.
3. Dashboard/alert wiring uses these canonical names.
