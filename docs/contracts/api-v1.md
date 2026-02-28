# DataVerse API Contract v1

Status: frozen from current implementation (`app/main.py`, `app/schemas.py`)  
Date: 2026-02-28

## Global rules
- No hard delete endpoints exist. Data removal is soft only (`.../extinguish` or parser `DELETE` command).
- All domain endpoints are multi-tenant and require `Authorization: Bearer <JWT>`.
- Data scope is always per `user_id + galaxy_id`.
- `galaxy_id` query/body is optional on many endpoints; if omitted, first active user galaxy is used.
- Time machine is supported via `as_of` on read endpoints.

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

## Asteroids and bonds
### `POST /asteroids/ingest`
- Auth required.
- Request: `{ "value": any, "metadata"?: object, "galaxy_id"?: uuid }`
- Behavior: find-or-create active asteroid by exact `value`; metadata may be merged by event.
- Response `200`: `AsteroidResponse`.

### `PATCH /asteroids/{asteroid_id}/extinguish`
- Auth required.
- Query: `galaxy_id?`
- Behavior: soft-deletes asteroid and connected bonds (event-sourced cascade).
- Response `200`: deleted `AsteroidResponse` (`is_deleted=true`, `deleted_at!=null`).
- Errors: `404` not found.

### `POST /bonds/link`
- Auth required.
- Request: `{ "source_id": uuid, "target_id": uuid, "type": string, "galaxy_id"?: uuid }`
- Response `200`: `BondResponse`.
- Errors: `422` same source/target or invalid context, `404` endpoint asteroid missing.

## Parser execution
### `POST /parser/execute`
- Auth required.
- Request: `{ "query"?: string, "text"?: string, "galaxy_id"?: uuid }`
- Validation:
- At least one of `query`/`text` must be present and non-empty.
- If both are present, they must be equal.
- Response `200` (`ParseCommandResponse`):
- `tasks[]`: parsed atomic tasks.
- `asteroids[]`, `bonds[]`: touched/created entities.
- `selected_asteroids[]`: `SELECT` output.
- `extinguished_asteroid_ids[]`, `extinguished_bond_ids[]`: soft-delete effects.
- Errors: `422` empty/invalid command, `404` target not found.

## Universe read models
### `GET /universe/snapshot`
- Auth required.
- Query: `galaxy_id?: uuid`, `as_of?: datetime`.
- Response `200`:
- `asteroids[]`: `{ id, value, table_id, table_name, metadata, calculated_values, active_alerts, created_at }`
- `bonds[]`: `{ id, source_id, target_id, type, source_table_id, source_table_name, target_table_id, target_table_name }`
- `as_of` behavior: only events with `timestamp <= as_of` are projected.
- Access errors: `403` foreign galaxy, `404` galaxy not found/deleted.

### `GET /universe/tables`
- Auth required.
- Query: `galaxy_id?: uuid`, `as_of?: datetime`.
- Response `200`: `{ tables: UniverseTableSnapshot[] }`.
- Each table contains schema/formula summary, members, bonds, and sector projection.

## Event-store event types used by executor
- `ASTEROID_CREATED`
- `METADATA_UPDATED`
- `BOND_FORMED`
- `ASTEROID_SOFT_DELETED`
- `BOND_SOFT_DELETED`
