# Mineral Contract v1

Status: frozen (MVP sign-off)
Date: 2026-03-05
Depends on: `docs/P0-core/contracts/table-contract-v1.md`, `docs/P0-core/contracts/civilization-contract-v1.md`, `docs/P0-core/contracts/moon-contract-v1.md`

## 1. Purpose

Mineral is the atomic data value mined from civilization members.
It includes typed value semantics and validation meaning in write/read paths.

## 2. Canonical representation

Mineral data is represented by:
- row main value: `asteroid.value`
- row metadata fields: `asteroid.metadata[*]`
- calculated values: projection `calculated_values[*]`
- normalized read-model facts: `facts[]` (`key`, `typed_value`, `value_type`, `source`, `status`, `errors`)

`value_type` enum in read model:
- `string`, `number`, `boolean`, `datetime`, `json`, `null`

`source` enum in read model:
- `value`, `metadata`, `calculated`

`status` enum in read model:
- `valid`, `hologram`, `invalid`

## 3. Validation and typing contract

When a table contract exists, effective writes must obey:
- `required_fields`
- `field_types`
- `validators`
- `unique_rules`

Formula minerals are read-only projection outputs and can contain calculation errors.
Circular formula dependencies are surfaced as invalid mineral facts (`#CIRC!` + error details).

## 4. Runtime behavior

1. Ingest/mutate validates incoming mineral payload before append.
2. Invalid payload returns contract violation and does not mutate timeline.
3. Snapshot/tables projection exposes typed mineral facts for UI/grid.
4. Soft-deleted civilization members do not leak active mineral facts.

## 5. Invariants

1. Mineral typing is deterministic for same input timeline.
2. Contract validation is scope-safe (`user_id + galaxy_id + branch_id`).
3. Formula mineral errors are explicit and non-silent.
4. No mineral-level operation can bypass no-hard-delete constitution.

## 6. Error model

- `422`: contract violation (type/validator/required/unique failure)
- `409`: OCC conflict on mutate paths
- `400`: malformed payload/formula request

## 7. DoD for this contract

1. Type/validator enforcement is consistent across ingest and mutate.
2. Formula and circular error states are visible in read-model facts.
3. Integration tests cover valid/invalid mineral writes and projection output.
4. FE grid receives stable mineral typing fields for rendering.

## 8. Closure evidence

1. `pytest -q tests/test_api_integration.py -k mineral_contract_gate_typing_validation_and_facts_projection`
