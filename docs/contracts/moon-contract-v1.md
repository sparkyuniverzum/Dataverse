# Moon Capability Contract v1

Status: draft (MVP baseline)  
Date: 2026-03-05  
Depends on: `docs/contracts/table-contract-v1.md`, `docs/contracts/api-v1.md`

## 1. Purpose

Moon is not population data itself.
Moon is a capability module that expands a Planet (table aggregate).

In MVP, Moon capabilities are expressed through table contract registries and relation rules.

## 2. Moon capability classes (MVP)

1. Dictionary Moon
- controlled value vocabularies (enum/category-like behavior)
- represented by contract validators / reference semantics

2. Validation Moon
- required/type/validator/unique behavior
- represented by `required_fields`, `field_types`, `validators`, `unique_rules`

3. Formula Moon
- computed minerals from source minerals
- represented by `formula_registry` and read-model calculated values/errors

4. Bridge Moon
- cross-planet linkage and flow rules
- represented by bond semantics (`RELATION|TYPE|FLOW|GUARDIAN`) and table-level link projections

## 3. Canonical carrier in current architecture

Moon capability state is carried by `TableContract`:
- `required_fields`
- `field_types`
- `unique_rules`
- `validators`
- `formula_registry`
- `physics_rulebook`

## 4. Runtime effect contract

Moon capability updates must affect:
1. write validation path (ingest/mutate)
2. read-model projection (`snapshot/tables`)
3. FE render and grid behavior via projection refresh

## 5. API path mapping

Primary write path:
- `POST /contracts/{table_id}` (upsert new contract version)

Runtime enforcement:
- `POST /asteroids/ingest`
- `PATCH /asteroids/{asteroid_id}/mutate`
- parser/task execution writes (`/parser/execute`, `/tasks/execute-batch`)

## 6. Invariants

1. Moon capability cannot bypass Star constitution laws.
2. Moon capability changes are versioned by contract history.
3. Moon capability effects are deterministic for the same input timeline.
4. No Moon capability may introduce hard-delete semantics.

## 7. Known MVP gap

Dedicated Moon CRUD endpoints do not exist yet.
Moon capability lifecycle is currently contract-driven (indirect), not object-entity CRUD.

## 8. DoD for this contract

1. Each Moon class is represented by at least one active contract scenario.
2. Contract update immediately impacts validation/projection paths.
3. Integration tests cover at least one flow per Moon class.

