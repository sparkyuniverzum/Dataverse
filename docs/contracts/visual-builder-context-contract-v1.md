# Visual Builder Context Contract v1

Status: approved target (Wave 0 readiness)
Date: 2026-03-07
Owner: Core BE/FE architecture
Depends on: `docs/contracts/api-v1.md`, `docs/contracts/table-contract-v1.md`, `docs/contracts/planet-civilization-domain-canonical-v1.md`, `docs/contracts/planet-civilization-delivery-canonical-v1.md`

## 1. Purpose

Define one canonical context payload for Visual Builder logic so FE does not stitch multiple domain views ad hoc.

This contract is the single source for:
1. Planet state,
2. Moon/Civilization runtime state,
3. Bond graph state,
4. Star/physics preview state.

## 2. Canonical source rule

1. FE Visual Builder must consume one normalized context envelope (`WorkspaceContextV1`).
2. No FE state logic may depend on unsynchronized mixed payloads.
3. If backend endpoint is unavailable, FE may compose the same envelope via adapter from existing reads in one refresh cycle.

## 3. Canonical endpoint target

Target endpoint (contract target for implementation):
- `GET /universe/workspace-context`

Query:
- `galaxy_id` (required)
- `branch_id` (optional)
- `planet_id` (optional; when present, civilization/moon detail scope is this planet)
- `include_civilizations` (optional, default `true`)
- `include_moon_impacts` (optional, default `false`)
- `as_of` (optional)

## 4. WorkspaceContextV1 envelope

```json
{
  "context_version": "wb-context-v1",
  "generated_at": "2026-03-07T10:00:00Z",
  "galaxy_id": "uuid",
  "branch_id": "uuid|null",
  "as_of": "datetime|null",
  "event_cursor": {
    "snapshot_event_seq": 0,
    "tables_event_seq": 0,
    "physics_event_seq": 0
  },
  "star": {
    "policy_locked": true,
    "physics_profile": "stable",
    "preview_engine_version": "star-physics-v2-preview"
  },
  "planets": [],
  "moons": [],
  "civilizations": [],
  "bonds": [],
  "issues": []
}
```

## 5. Entity shapes (required fields)

### 5.1 PlanetContextItem

Required:
- `planet_id` (`table_id`)
- `planet_name` (`table_name`)
- `constellation_name`
- `archetype`
- `contract_version`
- `is_empty`
- `moons_count`
- `civilizations_count`
- `internal_bonds_count`
- `external_bonds_count`
- `phase`
- `corrosion_level`
- `crack_intensity`
- `pulse_factor`
- `emissive_boost`

### 5.2 MoonContextItem

Required:
- `moon_id` (`civilization_id` carrier id)
- `planet_id`
- `label`
- `state` (`ACTIVE|WARNING|ANOMALY|ARCHIVED`)
- `health_score`
- `violation_count`
- `last_violation_at`
- `current_event_seq`

Optional:
- `impact_summary` (`rules_count`, `minerals_count`, `civilizations_count`) when `include_moon_impacts=true`

### 5.3 CivilizationContextItem

Required:
- `civilization_id`
- `planet_id`
- `label`
- `state`
- `health_score`
- `violation_count`
- `current_event_seq`
- `is_deleted`
- `facts[]` (`key`, `typed_value`, `value_type`, `status`, `errors[]`)

### 5.4 BondContextItem

Required:
- `bond_id`
- `source_civilization_id`
- `target_civilization_id`
- `source_planet_id`
- `target_planet_id`
- `type`
- `directional`
- `flow_direction`
- `is_deleted`
- `current_event_seq`

### 5.5 IssueItem

Required:
- `code`
- `severity` (`info|warning|critical`)
- `entity_kind` (`planet|moon|civilization|bond|workspace`)
- `entity_id`
- `message`

Optional:
- `repair_hint`
- `rule_id`
- `capability_id`

## 6. Mapping to current runtime reads (adapter mode)

Adapter inputs (current implementation):
1. `GET /universe/snapshot`
2. `GET /universe/tables`
3. `GET /galaxies/{galaxy_id}/star-core/physics/planets`
4. Optional scoped row detail: `GET /civilizations` (`planet_id` filtered)

Adapter invariants:
1. One refresh cycle must use one logical cursor (no partial mixed cycle).
2. `planet_id` selection must scope moon/civilization detail consistently.
3. Bond endpoints must be resolved against the same asteroid/civilization projection cycle.

## 7. Convergence and determinism rules

1. Same `(galaxy_id, branch_id, as_of, event_cursor)` must produce identical `WorkspaceContextV1`.
2. Live and replay projection paths must emit equivalent envelope semantics.
3. Missing optional sections (`civilizations`, `impact_summary`) must be explicit empty arrays/objects, not omitted.

## 8. Error model

Endpoint/adapter failures must use normalized detail:
- `code`
- `message`
- `context` (`workspace_context`)
- `stage` (`snapshot|tables|physics|civilizations|merge`)
- `retryable` (`true|false`)

Contract violation details inside `issues[]` must reuse canonical explainability keys:
- `rule_id`, `capability_id`, `mineral_key`, `expected_constraint`, `repair_hint`.

## 9. FE usage contract

1. Visual Builder state machine consumes only `WorkspaceContextV1`.
2. Planet/Moon/Civilization/Bond inspectors bind to context IDs, not ad hoc endpoint payloads.
3. Any endpoint-specific payload normalization is contained in adapter layer only.

## 10. DoD for this contract

1. Contract document is approved and linked from Wave 0 plan (`W0-LF-06`).
2. FE state machine specification references `WorkspaceContextV1` as sole input.
3. Test matrix includes payload shape gate for `WorkspaceContextV1`.
