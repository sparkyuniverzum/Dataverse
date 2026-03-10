# Planet-Civilization-Moon-Mineral Workflow v1

Status: archived (merged into `docs/contracts/planet-civilization-domain-canonical-v1.md`)
Date: 2026-03-09
Depends on:
- `docs/contracts/api-v1.md`
- `docs/contracts/civilization-contract-v1.md`
- `docs/contracts/moon-contract-v1.md`
- `docs/contracts/mineral-contract-v1.md`
- `docs/contracts/table-contract-v1.md`

Merged into:
- `docs/contracts/planet-civilization-domain-canonical-v1.md`

## 1. Purpose

Define one complete, backend-aligned runtime workflow for:
1. Planet lifecycle (table aggregate)
2. Civilization lifecycle (row aggregate, moon alias)
3. Mineral lifecycle (typed values inside civilization row)

Terminology rule:
- Canonical runtime name: `civilization`
- UX alias allowed: `moon` / `mesic`
- Both terms must resolve to the same row identity (`id`).

## 2. End-to-end workflow (happy path)

### Step A: Planet readiness

1. User selects or creates Planet.
2. FE refreshes projection from:
   - `GET /universe/snapshot`
   - `GET /universe/tables`
3. FE confirms selected `table_id` exists in the same projection cycle.

### Step B: Create civilization (moon row)

1. FE sends create payload to canonical route:
   - `POST /civilizations`
2. Fallback compatibility route (only when explicitly needed by status policy):
   - `POST /moons`
3. FE refreshes projection (`snapshot + tables`).
4. FE selects created row by returned id:
   - accepted aliases in response: `civilization_id | moon_id | id`

### Step C: Update civilization lifecycle

1. FE writes row label/value via canonical route:
   - `PATCH /civilizations/{civilization_id}/mutate`
2. Optional fallback:
   - `PATCH /moons/{moon_id}/mutate`
3. OCC support:
   - send `expected_event_seq` when available
   - on `409 OCC_CONFLICT`, refresh projection and show conflict guidance

### Step D: Upsert/remove mineral

1. FE writes mineral key/value:
   - `PATCH /civilizations/{civilization_id}/minerals/{mineral_key}`
2. Optional fallback:
   - `PATCH /moons/{moon_id}/minerals/{mineral_key}`
3. Remove-soft behavior:
   - empty value means remove mineral key, no hard delete
4. FE refreshes projection and keeps row selected.

### Step E: Extinguish civilization (soft archive)

1. FE sends:
   - `PATCH /civilizations/{civilization_id}/extinguish`
2. Optional fallback:
   - `PATCH /moons/{moon_id}/extinguish`
3. FE refreshes projection, row disappears from active list.

## 3. Projection normalization contract for FE

FE must normalize these aliases into one in-memory row shape (`asteroid`):

- source arrays:
  - `asteroids | civilizations | moons | atoms`
- row id:
  - `id | civilization_id | moon_id`
- planet binding:
  - `table_id | planet_id`
- minerals carrier:
  - `metadata | minerals`

Resulting FE row minimum:
- `id`
- `value`
- `table_id`
- `metadata`
- `current_event_seq` (if present)
- `is_deleted` (if present)

## 4. UI workflow obligations

Quick Grid must provide explicit operational path:
1. Planet selected
2. Civilization/moon row selected
3. Mineral key entered
4. Save executes write path and shows result

UI should auto-select first available row when grid opens and no row is selected, to avoid dead inspector state.

## 5. Error behavior

- `422` contract violation: show exact message, keep current row context
- `409` OCC conflict: refresh projection, keep workflow in edit mode
- `404` missing row/planet in scope: reset invalid selection and prompt reselection
- `403` scope violation: block action and keep projection unchanged

## 6. Verification checklist

1. [x] Create 2 civilizations in one planet:
   - both visible in 3D and grid immediately after refresh
2. [x] Select first civilization and write mineral:
   - mineral visible in inspector and table columns
3. [x] Archive one civilization:
   - removed from active grid and active 3D members
4. [x] Reopen grid:
   - first available row auto-selected
5. [x] Alias interoperability:
   - canonical `/civilizations*` and compatibility `/moons*` produce same FE row behavior

Evidence (2026-03-10):
1. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow` -> `1 passed`
2. `npm --prefix frontend run test:e2e:planet-moon-preview` -> `1 passed`
3. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`
4. `npm --prefix frontend run test -- src/lib/civilizationRuntimeRouteGate.test.js src/lib/parserExecutionTelemetry.test.js` -> `7 passed`
