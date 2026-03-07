# Moon Impact Contract v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: Core BE architecture
Depends on: `docs/contracts/moon-contract-v1.md`, `docs/contracts/civilization-mineral-contract-v2.md`, `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/planet-civilization-logical-flow-dod-v1.md`

## 1. Purpose

Define deterministic query contract for capability impact explainability:
1. which Moon capability/rule affects which minerals,
2. which civilizations are impacted,
3. what violations are currently active.

## 2. Endpoint target

Target endpoint:
- `GET /planets/{planet_id}/moon-impact`

Query:
- `galaxy_id` (required)
- `branch_id` (optional)
- `capability_id` (optional)
- `capability_key` (optional)
- `include_civilization_ids` (optional, default `true`)
- `include_violation_samples` (optional, default `true`)
- `limit` (optional, default `200`, max `1000`)

Resolution rules:
1. If `capability_id` is provided, it has priority over `capability_key`.
2. Without capability filter, endpoint returns impact summary for all active moon capabilities on the planet.

## 3. Response contract

```json
{
  "planet_id": "uuid",
  "galaxy_id": "uuid",
  "branch_id": "uuid|null",
  "generated_at": "2026-03-07T10:00:00Z",
  "items": [],
  "summary": {
    "capabilities_count": 0,
    "rules_count": 0,
    "impacted_civilizations_count": 0,
    "impacted_minerals_count": 0,
    "active_violations_count": 0
  }
}
```

Each `items[]` entry:
- `capability_id`
- `capability_key`
- `capability_class`
- `rule_id`
- `rule_kind` (`required|type|validator|unique|formula|bridge`)
- `mineral_key`
- `impact_kind` (`validate|derive|enforce|link`)
- `impacted_civilizations_count`
- `impacted_minerals_count`
- `active_violations_count`
- `impacted_civilization_ids[]` (optional by query)
- `violation_samples[]` (optional by query)

Each `violation_samples[]` entry:
- `civilization_id`
- `mineral_key`
- `state` (`WARNING|ANOMALY`)
- `detail`:
  - `rule_id`
  - `capability_id`
  - `expected_constraint`
  - `repair_hint`

## 4. Determinism and scope invariants

1. Scope is always `user_id + galaxy_id (+ branch_id)`.
2. Same timeline/cursor yields same impact result.
3. Soft-deleted civilizations are excluded from active impact counts unless explicit history mode is introduced.
4. Result set ordering:
   - `capability_key`,
   - `rule_id`,
   - `mineral_key`,
   - `civilization_id`.

## 5. Error model

Expected statuses:
- `400` invalid filter combination or limit overflow
- `401` auth/session invalid
- `403` foreign galaxy/branch access
- `404` planet/capability not found in resolved scope
- `422` impact projection cannot be resolved

Error detail must include:
- `code`
- `message`
- `context` (`moon_impact`)
- `entity_id` (if available)

## 6. FE integration contract

1. Moon Inspector uses this endpoint as primary source for impact tables.
2. Planet/Moon causal guidance references `summary` counts from this endpoint.
3. FE must not infer capability impact by guessing from local form state.

## 7. DoD for this contract

1. Contract is approved and linked from Wave 0 plan (`W0-LF-08`).
2. Impact payload fields are frozen and referenced by FE inspector contract.
3. Violation detail in impact samples reuses canonical explainability keys.
