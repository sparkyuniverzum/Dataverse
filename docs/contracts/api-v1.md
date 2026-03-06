# DataVerse API Contract v1

Status: frozen from current implementation (`app/main.py`, `app/schemas.py`)
Date: 2026-02-28 (updated 2026-03-05 for planets + grid sync contract)

## Global rules
- No hard delete endpoints exist. Data removal is soft only (`.../extinguish` or parser `DELETE` command).
- All domain endpoints are multi-tenant and require `Authorization: Bearer <JWT>`.
- Data scope is always per `user_id + galaxy_id`.
- `galaxy_id` query/body is optional on many endpoints; if omitted, first active user galaxy is used.
- Time machine is supported via `as_of` on read endpoints.
- If table contract exists for resolved table, all effective writes are validated against it before events are appended.
- Canonical domain language and semantics are defined in `docs/contracts/semantic-constitution-v1.md`.
- Write endpoints support optional `idempotency_key`; same key + same payload in same scope replays stored response, same key + different payload returns `409`.
- OCC conflicts (`409`) use unified payload:
  - `{ "detail": { "code": "OCC_CONFLICT", "message": string, "context": string, "entity_id": uuid, "expected_event_seq": int, "current_event_seq": int } }`

## Auth
### `POST /auth/register`
- Request: `{ "email": string, "password": string(min 8), "galaxy_name"?: string }`
- Response `201`: `{ access_token, token_type, user, default_galaxy }`
- Errors: `409` user exists.

### `POST /auth/login`
- Request: `{ "email": string, "password": string }`
- Response `200`: same shape as register.
- Errors: `401` invalid credentials.

### `GET /auth/me`
- Auth required.
- Response `200`: `UserPublic`.
- Errors: `401` invalid/expired token.

### `PATCH /auth/me/extinguish`
- Auth required.
- Soft-deletes current user (`deleted_at`) and deactivates account.
- Response `200`: `UserPublic`.

## Galaxies
### `GET /galaxies`
- Auth required.
- Response `200`: `GalaxyPublic[]` (only active user galaxies).

### `POST /galaxies`
- Auth required.
- Request: `{ "name": string(1..120) }`
- Response `201`: `GalaxyPublic`.

### `PATCH /galaxies/{galaxy_id}/extinguish`
- Auth required.
- Soft-deletes galaxy (`deleted_at`).
- Response `200`: `GalaxyPublic`.
- Errors: `404` not found, `403` foreign galaxy.

## Branches (git-like timelines)
### `GET /branches`
- Auth required.
- Query: `galaxy_id?: uuid`.
- Response `200`: `BranchPublic[]` (active branches for galaxy).

### `POST /branches`
- Auth required.
- Request: `{ "name": string(1..120), "galaxy_id"?: uuid, "as_of"?: datetime }`
- Response `201`: `BranchPublic`.
- Behavior: branch base snapshot is pinned to main timeline at creation time (`as_of` optional).
- Naming guard: within one galaxy, active branch names are unique by normalized form `trim(name).casefold()`.
- Errors: `409` when normalized name already exists.

### `POST /branches/{branch_id}/promote`
- Auth required.
- Query: `galaxy_id?: uuid`.
- Response `200`: `{ "branch": BranchPublic, "promoted_events_count": number }`.
- Behavior: replays branch events into main timeline in-order and then closes branch (`deleted_at` set).
- Errors: `404` branch not found/deleted, `403` foreign branch access.

### `PATCH /branches/{branch_id}/extinguish`
- Auth required.
- Query: `galaxy_id?: uuid`.
- Response `200`: `BranchPublic` (`deleted_at` set).

## Planets (table aggregate lifecycle)
### `GET /planets`
- Auth required.
- Query: `galaxy_id?: uuid`, `branch_id?: uuid`.
- Response `200`: `{ items: PlanetPublic[] }`.
- `PlanetPublic` includes: `table_id`, `table_name`, `constellation_name`, `planet_name`, `archetype`, `contract_version`, `moons_count`, `schema_fields`, `formula_fields`, `internal_bonds_count`, `external_bonds_count`, `sector`, `is_empty`, optional `contract`.

### `GET /planets/{table_id}`
- Auth required.
- Query: `galaxy_id?: uuid`, `branch_id?: uuid`.
- Response `200`: `PlanetPublic`.
- Errors: `404` planet not found in resolved scope.

### `POST /planets`
- Auth required.
- Request:
  - `{ "name": string(2..120), "archetype"?: "catalog"|"stream"|"junction", "visual_position"?: {x,y,z}, "initial_schema_mode"?: "empty"|"preset", "schema_preset_key"?: string, "seed_rows"?: bool, "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Response `201`: `PlanetCreateResponse` with `contract` + `table`.
- Rules:
  - lifecycle writes are allowed only on main timeline (`branch_id=null`), otherwise `409`
  - for `initial_schema_mode="preset"`, `schema_preset_key` is required
  - appends `PLANET_CREATED` event and projects to read models in same transaction boundary (main timeline)

### `PATCH /planets/{table_id}/extinguish`
- Auth required.
- Query: `galaxy_id?: uuid`, `branch_id?: uuid`, `idempotency_key?: string`.
- Response `200`: `{ table_id, extinguished, deleted_contract_versions }`.
- Rules:
  - lifecycle writes are allowed only on main timeline (`branch_id=null`), otherwise `409`
  - extinguish allowed only for empty planet (no members, no internal/external bonds), otherwise `409`
  - soft-delete contract history only (no hard delete), appends `PLANET_EXTINGUISHED`

## Asteroids and bonds
### `POST /asteroids/ingest`
- Auth required.
- Request: `{ "value": any, "metadata"?: object, "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Behavior: find-or-create active asteroid by exact `value`; metadata may be merged by event.
- Response `200`: `AsteroidResponse`.

### `PATCH /asteroids/{asteroid_id}/extinguish`
- Auth required.
- Query: `galaxy_id?`, `branch_id?`, `expected_event_seq?`, `idempotency_key?`
- Behavior: soft-deletes asteroid and connected bonds (event-sourced cascade).
- OCC (optional): if `expected_event_seq` is provided and current entity event sequence differs, endpoint returns `409`.
- Response `200`: deleted `AsteroidResponse` (`is_deleted=true`, `deleted_at!=null`).
- Errors: `404` not found, `409` optimistic concurrency conflict.

### `PATCH /asteroids/{asteroid_id}/mutate`
- Auth required.
- Request: `{ "value"?: any, "metadata"?: object, "expected_event_seq"?: int>=0, "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Behavior: updates value/metadata via event log (`ASTEROID_VALUE_UPDATED`, `METADATA_UPDATED`).
- OCC (optional): if `expected_event_seq` is provided and current entity event sequence differs, endpoint returns `409`.
- Response `200`: updated `AsteroidResponse`.
- Errors: `404` not found, `409` optimistic concurrency conflict.

## Civilization rows (transitional naming)

Current runtime includes first-class row lifecycle on both endpoint families:
- canonical `/civilizations*`,
- compatibility alias `/moons*`.

### Transitional row API (implemented)
- `GET /moons`
- `GET /moons/{moon_id}`
- `POST /moons`
- `PATCH /moons/{moon_id}/mutate`
- `PATCH /moons/{moon_id}/extinguish`

### Canonical naming (implemented, migration target for clients)
- `GET /civilizations`
- `GET /civilizations/{civilization_id}`
- `POST /civilizations`
- `PATCH /civilizations/{civilization_id}/mutate`
- `PATCH /civilizations/{civilization_id}/extinguish`

## Moon capabilities (first-class capability aggregate)

### `GET /planets/{planet_id}/capabilities`
- Auth required.
- Query: `galaxy_id?: uuid`, `branch_id?: uuid`, `include_inactive?: bool`, `include_history?: bool`.
- Response `200`: `{ "items": MoonCapabilityPublic[] }`.
- Rules:
  - capability lifecycle is currently main timeline only (`branch_id=null`), otherwise `409`.
  - default list returns active current versions only.
  - `include_inactive=true` includes deprecated active versions.
  - `include_history=true` also includes historical superseded versions.

### `POST /planets/{planet_id}/capabilities`
- Auth required.
- Request:
  - `{ "galaxy_id"?: uuid, "branch_id"?: uuid, "capability_key": string, "capability_class": "dictionary"|"validation"|"formula"|"bridge", "config"?: object, "order_index"?: int, "status"?: "active"|"deprecated", "idempotency_key"?: string }`
- Response `201`: `MoonCapabilityPublic`.
- Rules:
  - upsert is keyed by `(galaxy_id, planet_id, capability_key)` in active space.
  - unchanged payload returns current active version.
  - changed payload creates next version and supersedes previous active row.

### `PATCH /capabilities/{capability_id}`
- Auth required.
- Request:
  - `{ "galaxy_id"?: uuid, "branch_id"?: uuid, "capability_class"?: "...", "config"?: object, "order_index"?: int, "status"?: "active"|"deprecated", "expected_version"?: int>=1, "idempotency_key"?: string }`
- Response `200`: `MoonCapabilityPublic`.
- OCC:
  - if `expected_version` differs from current version, endpoint returns `409` with `code=OCC_CONFLICT`.

### `PATCH /capabilities/{capability_id}/deprecate`
- Auth required.
- Request: `{ "galaxy_id"?: uuid, "branch_id"?: uuid, "expected_version"?: int>=1, "idempotency_key"?: string }`
- Response `200`: `MoonCapabilityPublic` (`status="deprecated"`).

### `POST /bonds/link`
- Auth required.
- Request: `{ "source_id": uuid, "target_id": uuid, "type": string, "expected_source_event_seq"?: int>=0, "expected_target_event_seq"?: int>=0, "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Response `200`: `BondResponse` with `type`, `directional`, `flow_direction`.
- `RELATION` semantics: canonical undirected pair (A-B equals B-A), reverse direction reuses existing active bond.
- Type normalization: aliases are normalized before write (`FORMULA` -> `FLOW`, `REL`/`LINK` -> `RELATION`, `GUARD`/`WATCH` -> `GUARDIAN`).
- OCC (optional): if expected source/target sequence is provided and differs from current sequence, endpoint returns `409`.
- Errors: `422` same source/target or invalid context, `404` endpoint asteroid missing, `409` optimistic concurrency conflict.

### `PATCH /bonds/{bond_id}/mutate`
- Auth required.
- Request: `{ "type": string, "expected_event_seq"?: int>=0, "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Behavior: updates bond type by soft-deleting current bond event stream and creating a new canonical bond with new type.
- Response `200`: updated `BondResponse` (can contain new `id` when type changed).
- Errors: `404` bond not found, `409` OCC conflict or target edge/type already exists.

### `PATCH /bonds/{bond_id}/extinguish`
- Auth required.
- Query: `galaxy_id?`, `branch_id?`, `expected_event_seq?`, `idempotency_key?`
- Behavior: soft-deletes selected bond.
- Response `200`: deleted `BondResponse` (`is_deleted=true`, `deleted_at!=null`).
- Errors: `404` bond not found, `409` OCC conflict.

## Parser execution
### `POST /parser/execute`
- Auth required.
- Request: `{ "query"?: string, "text"?: string, "parser_version"?: "v1"|"v2", "idempotency_key"?: string, "galaxy_id"?: uuid, "branch_id"?: uuid }`
- Validation:
- At least one of `query`/`text` must be present and non-empty.
- If both are present, they must be equal.
- `parser_version` default = `v2`; unsupported value -> `422`.
- `parser_version=v1`: V1 parser pipeline.
- `parser_version=v2`: Parser2 pipeline (`lexer -> AST -> planner -> bridge`) over the same executor.
- `parser_version=v2` resolver: existující uzly se přednostně mapují z aktivního branch-aware snapshotu (`NAME -> ID`) před vytvořením nového uzlu.
- Legacy verb commands (`show/find/ukaz/najdi/delete/zhasni/smaz/hlidej/spocitej/spoj`) are natively compiled in Parser2 with V1-compatible semantics.
- Legacy metadata syntax (`Entity (k: v, x=y)`) is natively compiled in Parser2 with V1-compatible semantics.
- Unquoted UUID operands and unquoted hyphenated labels (e.g. `63b9d... + Projekt`, `Node-ABC + Team-1`) are accepted in `v2`.
- Resolver nejednoznačnosti ve `v2` vrací deterministicky `422` (`PLAN_RESOLVE_AMBIGUOUS_NAME`).
- Compatibility fallback: pokud klient `parser_version` neposílá a `v2` parse selže, endpoint může zkusit legacy `v1` parser.
- Rollout flag: `DATAVERSE_PARSER_V2_FALLBACK_TO_V1` (default `false`), `true` fallback dočasně zapne.
- Response `200` (`ParseCommandResponse`):
- `tasks[]`: parsed atomic tasks.
- `asteroids[]`, `bonds[]`: touched/created entities.
- `selected_asteroids[]`: `SELECT` output.
- `extinguished_asteroid_ids[]`, `extinguished_bond_ids[]`: soft-delete effects.
- Errors: `422` empty/invalid command, `404` target not found.

## Universe read models
### `GET /universe/snapshot`
- Auth required.
- Query: `galaxy_id?: uuid`, `as_of?: datetime`, `branch_id?: uuid`.
- Response `200`:
- `asteroids[]`: `{ id, value, table_id, table_name, metadata, calculated_values, active_alerts, created_at }`
- `asteroids[]` include `current_event_seq` (latest event sequence visible in selected timeline).
- `bonds[]`: `{ id, source_id, target_id, type, directional, flow_direction, source_table_id, source_table_name, target_table_id, target_table_name, current_event_seq }`
- `as_of` behavior: only events with `timestamp <= as_of` are projected.
- Access errors: `403` foreign galaxy, `404` galaxy not found/deleted.

### `GET /universe/tables`
- Auth required.
- Query: `galaxy_id?: uuid`, `as_of?: datetime`, `branch_id?: uuid`.
- Response `200`: `{ tables: UniverseTableSnapshot[] }`.
- Each table contains schema/formula summary, members, bonds, and sector projection.
- `UniverseTableSnapshot` also includes `archetype?` and `contract_version?`.
- Access errors: `403` foreign galaxy/branch, `404` galaxy or branch not found/deleted.

## Galaxy event stream (SSE)
### `GET /galaxies/{galaxy_id}/events/stream`
- Auth required.
- Query:
  - `branch_id?: uuid`
  - `last_event_seq?: int>=0`
  - `poll_ms?: int` (`300..10000`, default `1200`)
  - `heartbeat_sec?: int` (`5..60`, default `15`)
  - `batch_size?: int` (`1..256`, default `64`)
- Response: `text/event-stream`.
- Event types:
  - `ready`: initial cursor (`last_event_seq`)
  - `update`: batch with `events[]` (`event_seq`, `event_type`, `entity_id`, `payload`, `timestamp`)
  - `keepalive`: heartbeat with current cursor
- Contract for FE:
  - stream is convergence trigger, not direct renderer state source
  - on `update`, FE refreshes projection sources (`/universe/snapshot` + `/universe/tables`)
- after reconnect, FE resumes by `last_event_seq` and performs full projection refresh on sequence uncertainty

## Star core physics migration (v2 additive)
### `POST /galaxies/{galaxy_id}/star-core/physics/profile/migrate`
- Auth required.
- Request:
  - `{ "from_version": int>=1, "to_version": int>=1, "reason": string(1..240), "dry_run"?: bool }`
- Behavior:
  - migration is allowed only when Star Core policy is already locked
  - `from_version` must match current locked physical profile version
  - `to_version` must be greater than `from_version`
  - `dry_run=true` returns impact summary without mutation
  - `dry_run=false` applies profile version migration in-place (version bump only)
- Response `200`:
  - `{ galaxy_id, profile_key, from_version, to_version, reason, dry_run, applied, lock_status, impacted_planets, estimated_runtime_items }`
- Errors:
  - `409` policy not initialized/not locked/version mismatch
  - `422` invalid migration payload

## IO (CSV import/export, Phase 1)
### `POST /io/imports`
- Auth required.
- Multipart form fields:
- `file` (required, `.csv`, UTF-8)
- `mode` (`preview|commit`, default `commit`)
- `strict` (`true|false`, default `true`)
- `galaxy_id?` (uuid; if omitted, default active user galaxy)
- `branch_id?` (uuid; if provided, import writes into selected branch timeline)
- Response `200`: `{ job: ImportJobPublic }`
- Validation errors: `422` missing/empty file, non-CSV file, invalid CSV encoding.
- Behavior:
- `preview`: validates/parses rows, writes import job + errors, no domain writes.
- `commit`: executes row tasks; with `strict=false` continues after row errors; with `strict=true` stops on first row error.

### `GET /io/imports/{job_id}`
- Auth required.
- Response `200`: `ImportJobPublic`.
- Errors: `404` if job is missing or belongs to another user.

### `GET /io/imports/{job_id}/errors`
- Auth required.
- Response `200`: `{ errors: ImportErrorPublic[] }`.
- `ImportErrorPublic.code` is typed by failure class (`ROW_INPUT_INVALID`, `ROW_DOMAIN_VALIDATION`, `ROW_CONTRACT_VIOLATION`, `ROW_TARGET_NOT_FOUND`, `ROW_CONFLICT`/domain conflict code, `ROW_INTERNAL_ERROR`, `ROW_UNEXPECTED_ERROR`).
- `ImportErrorPublic.raw_value` stores structured JSON string with source row + normalized error envelope:
  - `{ "row": {...}, "error": { "code": string, "message": string, "details": object } }`
- Errors: `404` if job is missing or belongs to another user.

### `GET /io/exports/snapshot`
- Auth required.
- Query: `format=csv` (only supported), `galaxy_id?`, `branch_id?`, `as_of?`.
- Response `200`: downloadable CSV (`text/csv`).
- Validation errors: `422` for unsupported export format.

### `GET /io/exports/tables`
- Auth required.
- Query: `format=csv` (only supported), `galaxy_id?`, `branch_id?`, `as_of?`.
- Response `200`: downloadable CSV (`text/csv`).
- Validation errors: `422` for unsupported export format.

## Event-store event types used by executor
- `ASTEROID_CREATED`
- `METADATA_UPDATED`
- `BOND_FORMED`
- `ASTEROID_SOFT_DELETED`
- `BOND_SOFT_DELETED`

## Cosmos Sprint 1 extension (implemented)
- Scenario branches and table contracts are specified in:
- `docs/contracts/cosmos-sprint1-openapi.yaml`
- Implemented endpoints:
- `GET/POST /branches`
- `POST /branches/{branch_id}/promote`
- `PATCH /branches/{branch_id}/extinguish`
- `GET/POST /contracts/{table_id}`
- Branch-aware snapshot:
- `GET /universe/snapshot?...&branch_id=<uuid>`
- Table contract registry pack:
- `schema_registry` (contract envelope for required/type/unique/validators)
- `formula_registry` (catalog of formula definitions per table/planet)
- `physics_rulebook` (UI/physics mapping rules and defaults per table/planet)
