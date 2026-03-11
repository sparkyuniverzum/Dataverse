# DataVerse Table Contract v1

Status: frozen from current implementation (`app/services/universe_service.py`, `app/schemas.py`)
Date: 2026-02-28

## What is a "table" in DataVerse
A table is a visual/read-model grouping of active asteroids in one galaxy. It is derived, not physically stored.

Table identity for each asteroid is computed as:
1. Resolve `table_name`.
2. Resolve deterministic `table_id = uuid5(NAMESPACE_URL, "dataverse:{galaxy_id}:{lower(table_name)}")`.

## Table name derivation
Priority order:
1. Metadata keys (first non-empty string):
- `kategorie`, `category`, `typ`, `type`, `table`, `table_name`
2. Value prefix pattern:
- if asteroid `value` is string matching `^\s*([A-Za-zÀ-ž0-9 _-]{2,64})\s*:` then captured prefix is table name
3. Fallback:
- `Uncategorized`

Normalization:
- trim whitespace
- empty result -> `Uncategorized`

## `/universe/snapshot` table fields
Each asteroid includes:
- `table_id`
- `table_name`

Each bond includes:
- `source_table_id`, `source_table_name`
- `target_table_id`, `target_table_name`

Only active asteroids/bonds are returned (soft-deleted entities are excluded).

## `/universe/tables` aggregate contract
Response shape:
- `tables[]` with:
- `table_id`, `galaxy_id`, `name`
- `schema_fields[]`: metadata keys excluding private keys starting with `_`
- `formula_fields[]`: metadata keys whose value starts with `=`
- `members[]`: `{ id, value, created_at }`
- `internal_bonds[]`: bonds where both endpoints are in same table
- `external_bonds[]`: bonds to other tables plus peer table info
- `sector`: `{ center:[x,y,z], size, mode, grid_plate }`

## Sector projection rules
- Table ordering: by `(name.lower(), table_id)`.
- Sector center: deterministic grid with spacing `500` (X/Z), Y=0.
- Sector mode:
- `ring` if `members_count > 5` OR `schema_fields_count > 3`
- otherwise `belt`
- Sector size:
- `max(260, min(460, 260 + sqrt(max(members,1))*48 + (80 if ring else 20)))`
- `grid_plate` is always `true`.

## Time machine compatibility
Both `/universe/snapshot` and `/universe/tables` accept `as_of`.
Projection uses events `timestamp <= as_of`, then applies the same table derivation rules.

## Integrity constraints
- No hard delete in table model.
- `ASTEROID_SOFT_DELETED` removes asteroid from live table projection.
- `BOND_SOFT_DELETED` removes bond from live table projection.
- History remains reconstructable via event log + `as_of`.
