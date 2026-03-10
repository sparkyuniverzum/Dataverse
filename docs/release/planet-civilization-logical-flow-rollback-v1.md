# Planet/Civilization Logical Flow Rollback v1

Status: archived (merged into `docs/release/planet-civilization-operations-canonical-v1.md`)
Date: 2026-03-07
Owner: Release + BE + FE
Depends on: `docs/release/planet-civilization-feature-flag-rollout-v1.md`, `docs/release/v1-rollout-runbook.md`

Merged into:
- `docs/release/planet-civilization-operations-canonical-v1.md`

## 1. Purpose

Define deterministic rollback procedure for logical-flow rollout incidents.

## 2. Rollback triggers

1. P1 incident in moon discovery or bond preview path.
2. Rejected-bond error spike above threshold for 15 minutes.
3. Cross-planet guard failures causing blocked critical workflows.

## 3. Rollback order

1. Disable `cross_planet_guard_v1`.
2. Disable `bond_builder_v1`.
3. Disable `moon_discovery_v1`.
4. If instability persists, revert to previous release profile according to `v1-rollout-runbook`.

## 4. Rollback checklist

1. Identify active phase and impacted cohort.
2. Execute flag rollback commands.
3. Verify key read paths:
   - `GET /universe/snapshot`
   - `GET /universe/tables`
4. Verify critical write paths:
   - `POST /civilizations`
   - `POST /bonds/link`
5. Run smoke subset:
   - workspace select -> grid open
   - create civilization -> mutate mineral
   - create bond in single planet
6. Publish incident update with rollback timestamp.

## 5. On-call ownership

1. Primary incident commander: Release Owner
2. BE on-call: API/validation regressions
3. FE on-call: UI/builder regressions
4. QA on-call: smoke revalidation

## 6. Rollback SLO

1. Start rollback within 10 minutes from trigger.
2. Stabilize core flows within 30 minutes.
3. Post-incident summary within 24 hours.

## 7. DoD for rollback policy

1. Checklist and ownership are documented.
2. Runbook references this document.
3. Rollback drill execution is planned in next staging window.
