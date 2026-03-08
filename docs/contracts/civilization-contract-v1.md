# Civilization Contract v1

Status: frozen (MVP sign-off)
Date: 2026-03-05
Depends on: `docs/contracts/api-v1.md`, `docs/contracts/table-contract-v1.md`, `docs/contracts/moon-contract-v1.md`

## 1. Purpose

Civilization is the live population of one Planet.
In current implementation, civilization is represented by active asteroid rows scoped to one table/planet.

## 2. Canonical carrier

- Entity carrier: asteroid row (`id`, `value`, `metadata`, `is_deleted`, `current_event_seq`)
- Scope carrier: `user_id + galaxy_id (+ branch_id)`
- Planet binding: derived `table_id` / `table_name` from row semantics and metadata

## 3. Lifecycle API surface

Canonical API surface (implemented):
- `GET /civilizations`
- `GET /civilizations/{civilization_id}`
- `POST /civilizations`
- `POST /civilizations/ingest`
- `PATCH /civilizations/{civilization_id}/mutate`
- `PATCH /civilizations/{civilization_id}/extinguish`

Compatibility runtime API surface (alias):
- `GET /moons`
- `GET /moons/{moon_id}`
- `POST /moons`
- `PATCH /moons/{moon_id}/mutate`
- `PATCH /moons/{moon_id}/extinguish`

Primary row lifecycle:
- `POST /asteroids/ingest`
- `PATCH /asteroids/{asteroid_id}/mutate`
- `PATCH /asteroids/{asteroid_id}/extinguish`

Command write paths that can mutate civilization:
- `POST /parser/execute`
- `POST /tasks/execute-batch`

Read paths:
- `GET /universe/snapshot`
- `GET /universe/tables`
- `GET /galaxies/{galaxy_id}/moons`

## 4. Required runtime behavior

1. Insert creates new active civilization member with deterministic scope.
2. Mutate applies partial updates with OCC protection where expected sequence is provided.
3. Extinguish performs soft delete only (`is_deleted=true`, event-sourced history preserved).
4. Projection hides soft-deleted members from active views but keeps them in historical timeline.

## 5. Invariants

1. No hard-delete path for civilization members.
2. Contract validation is applied before effective write when table contract exists.
3. Repeated idempotent write does not duplicate side effects.
4. Foreign galaxy access is denied (`403`).
5. Branch scope isolation is preserved.

## 6. Error model

- `400`: invalid payload / semantic command error
- `401`: auth/session invalid
- `403`: foreign galaxy/branch access
- `404`: target entity not found in resolved scope
- `409`: OCC conflict or semantic conflict
- `422`: table contract violation

## 7. DoD for this contract

1. Civilization lifecycle endpoints are stable under OCC + idempotency.
2. Active projection converges after ingest/mutate/extinguish.
3. Integration tests cover create/mutate/soft-delete + projection convergence.
4. Contract validation failures return stable error shape and do not append invalid writes.

## 8. Closure evidence

1. `pytest -q tests/test_api_integration.py -k civilization_contract_gate_create_mutate_extinguish_and_converge`
