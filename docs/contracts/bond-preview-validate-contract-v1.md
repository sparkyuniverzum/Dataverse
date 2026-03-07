# Bond Preview/Validate Contract v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: Core BE architecture
Depends on: `docs/contracts/api-v1.md`, `docs/contracts/visual-builder-context-contract-v1.md`, `docs/contracts/planet-civilization-logical-flow-dod-v1.md`

## 1. Purpose

Define deterministic pre-commit validation for bond creation/mutation so FE can show explicit allow/reject reasons before write.

## 2. Endpoint target

Target endpoint:
- `POST /bonds/validate`

Behavior:
1. Read-only dry-run (no event append, no projection mutation).
2. Returns deterministic decision envelope for one proposed bond operation.

## 3. Request contract

```json
{
  "galaxy_id": "uuid",
  "branch_id": "uuid|null",
  "operation": "create|mutate|extinguish",
  "source_civilization_id": "uuid",
  "target_civilization_id": "uuid",
  "bond_id": "uuid|null",
  "type": "RELATION|FLOW|GUARDIAN|TYPE",
  "expected_source_event_seq": 0,
  "expected_target_event_seq": 0,
  "expected_bond_event_seq": 0,
  "idempotency_key": "string|null"
}
```

Rules:
1. `create` requires `source_civilization_id`, `target_civilization_id`, `type`.
2. `mutate` requires `bond_id`, `type`.
3. `extinguish` requires `bond_id`.

## 4. Response contract

```json
{
  "decision": "ALLOW|REJECT|WARN",
  "accepted": true,
  "blocking": false,
  "normalized": {
    "source_civilization_id": "uuid",
    "target_civilization_id": "uuid",
    "type": "RELATION",
    "directional": false,
    "flow_direction": null,
    "canonical_pair": "source<->target"
  },
  "preview": {
    "cross_planet": false,
    "source_planet_id": "uuid",
    "target_planet_id": "uuid",
    "existing_bond_id": "uuid|null",
    "would_create": true,
    "would_replace": false,
    "would_extinguish": false
  },
  "reasons": []
}
```

Decision semantics:
1. `ALLOW`: operation may proceed without blockers.
2. `WARN`: operation may proceed; non-blocking warnings are present.
3. `REJECT`: operation must not be committed.

## 5. Reject/warn taxonomy

Each reason item:
- `code`
- `severity` (`info|warning|error`)
- `blocking` (`true|false`)
- `message`
- `rule_id` (nullable)
- `capability_id` (nullable)
- `context` (object)

Required reject codes:
1. `BOND_VALIDATE_SAME_ENDPOINT`
2. `BOND_VALIDATE_SOURCE_MISSING`
3. `BOND_VALIDATE_TARGET_MISSING`
4. `BOND_VALIDATE_BOND_MISSING`
5. `BOND_VALIDATE_OCC_CONFLICT`
6. `BOND_VALIDATE_DUPLICATE_EDGE`
7. `BOND_VALIDATE_TYPE_FORBIDDEN`
8. `BOND_VALIDATE_CROSS_PLANET_FORBIDDEN`
9. `BOND_VALIDATE_SCOPE_FORBIDDEN`
10. `BOND_VALIDATE_STAR_POLICY_BLOCK`

Optional warning codes:
1. `BOND_VALIDATE_CROSS_PLANET_WARN`
2. `BOND_VALIDATE_TYPE_COERCED`
3. `BOND_VALIDATE_EDGE_REUSE`

## 6. Determinism and parity rules

1. Same input + same event cursor -> same decision envelope.
2. If `decision=ALLOW`, commit path (`POST /bonds/link` or mutation/extinguish endpoint) must not reject for a rule already evaluated in validate path unless timeline changed.
3. Response `normalized` fields must match actual write normalization logic.

## 7. Error model

Validation endpoint technical errors:
- `400` malformed payload
- `401` auth/session invalid
- `403` foreign galaxy/branch scope
- `404` referenced entities not found (when technical resolution cannot produce reason envelope)
- `409` OCC precondition conflict on validate request itself
- `422` semantic validation envelope could not be built

Preferred behavior:
- business-level validation failures return `200` with `decision=REJECT` and structured `reasons[]`.

## 8. FE integration contract

1. Bond builder must call validate endpoint before commit.
2. FE must show every blocking reason deterministically.
3. Commit action is disabled while `blocking=true`.
4. FE telemetry emits:
   - `bond_preview_rejected`
   - `bond_preview_warned`
   - `bond_preview_allowed`

## 9. DoD for this contract

1. Contract is approved and linked from Wave 0 plan (`W0-LF-07`).
2. Reject taxonomy is frozen and referenced by BE integration tests.
3. FE bond builder flow references `decision` + `reasons[]` semantics.
