# Star Physics Laws Contract v2

Status: frozen for MVP gate
Date: 2026-03-05
Depends on: `docs/P0-core/contracts/api-v1.md`, `docs/P0-core/baselines/star-contract-baseline-v1.json`, `docs/P0-core/baselines/star-physics-contract-baseline-v2.json`

## 1. Purpose

Define implementable BE/FE contracts for Star physical laws:
- immutable constitutional policy remains mandatory,
- physical profile determines deterministic planet behavior,
- FE consumes backend runtime output as source of truth.

Frozen v1 contracts remain unchanged.
This file specifies additive v2 capabilities.

## 2. Terminology

- `Constitution Laws`: immutable safety/governance rules.
- `Physical Laws`: deterministic runtime behavior of planets.
- `Star profile`: one of `FORGE`, `BALANCE`, `ARCHIVE`.
- `Planet runtime state`: computed physics snapshot per planet.

## 3. Invariants

1. No hard delete paths are introduced.
2. Constitution fields cannot be edited after lock.
3. Physical profile cannot be directly edited after lock.
4. Profile changes are migration events, not updates-in-place.
5. Same input timeline must produce same runtime state.

## 4. API delta (v2 additions)

## 4.1 Extend lock endpoint

Existing endpoint:
- `POST /galaxies/{galaxy_id}/star-core/policy/lock`

Extended request payload:
```json
{
  "profile_key": "ORIGIN",
  "lock_after_apply": true,
  "physical_profile_key": "BALANCE",
  "physical_profile_version": 1
}
```

Behavior:
1. Applies constitution profile.
2. Locks constitution profile.
3. Stores and locks physical profile key/version atomically.

Compatibility:
- if `physical_profile_key` missing, default `BALANCE` is applied.

## 4.2 New physical profile read endpoint

`GET /galaxies/{galaxy_id}/star-core/physics/profile`

Response 200:
```json
{
  "galaxy_id": "uuid",
  "profile_key": "BALANCE",
  "profile_version": 1,
  "lock_status": "locked",
  "locked_at": "2026-03-05T11:00:00Z",
  "coefficients": {
    "a": 0.08,
    "b": 0.14,
    "c": 0.14,
    "d": 0.40,
    "e": 0.20,
    "f": 0.30,
    "u": 0.07,
    "v": 0.07,
    "g": 0.35,
    "h": 0.22,
    "l0": 0.24,
    "p0": 0.20
  }
}
```

## 4.3 New runtime planets endpoint (optional fast-path)

`GET /galaxies/{galaxy_id}/star-core/physics/planets`

Query:
- `branch_id?: uuid`
- `after_event_seq?: int>=0`
- `limit?: int<=1000`

Response 200:
```json
{
  "as_of_event_seq": 1234,
  "items": [
    {
      "table_id": "uuid",
      "phase": "ACTIVE",
      "metrics": {
        "activity": 0.62,
        "stress": 0.18,
        "health": 0.91,
        "inactivity": 0.11,
        "corrosion": 0.09,
        "rows": 384
      },
      "visual": {
        "size_factor": 1.31,
        "luminosity": 0.56,
        "pulse_rate": 0.41,
        "hue": 0.42,
        "saturation": 0.66,
        "corrosion_level": 0.09,
        "crack_intensity": 0.05
      },
      "source_event_seq": 1232,
      "engine_version": "planet-physics-v2.1"
    }
  ]
}
```

Note:
- If preferred, this payload can be embedded into `/universe/tables` rows instead of separate endpoint.

## 5. Event contract additions

New domain events (append-only):
1. `STAR_PHYSICAL_PROFILE_LOCKED`
2. `STAR_PHYSICAL_PROFILE_MIGRATED`
3. `PLANET_PHYSICS_STATE_UPDATED`
4. `PLANET_PHASE_CHANGED`
5. `PLANET_CORROSION_UPDATED`

Event payload examples:
```json
{
  "event_type": "STAR_PHYSICAL_PROFILE_LOCKED",
  "payload": {
    "profile_key": "BALANCE",
    "profile_version": 1,
    "coefficients_hash": "sha256:..."
  }
}
```

```json
{
  "event_type": "PLANET_PHASE_CHANGED",
  "entity_id": "table_uuid",
  "payload": {
    "from_phase": "DORMANT",
    "to_phase": "CORRODING",
    "activity": 0.08,
    "inactivity": 0.81,
    "corrosion": 0.64
  }
}
```

## 6. Read-model schema (DDL proposal)

## 6.1 Star physical profile

```sql
create table if not exists star_physics_profile (
  id uuid primary key,
  user_id uuid not null,
  galaxy_id uuid not null,
  profile_key varchar(32) not null,
  profile_version int not null,
  coefficients jsonb not null,
  lock_status varchar(16) not null default 'locked',
  locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists uq_star_physics_profile_active
  on star_physics_profile(user_id, galaxy_id)
  where deleted_at is null;
```

## 6.2 Planet runtime physics state

```sql
create table if not exists planet_runtime_state_rm (
  id uuid primary key,
  user_id uuid not null,
  galaxy_id uuid not null,
  table_id uuid not null,
  branch_id uuid null,
  phase varchar(32) not null,
  activity numeric(6,5) not null,
  stress numeric(6,5) not null,
  health numeric(6,5) not null,
  inactivity numeric(6,5) not null,
  corrosion numeric(6,5) not null,
  rows_count bigint not null default 0,
  size_factor numeric(7,5) not null,
  luminosity numeric(6,5) not null,
  pulse_rate numeric(6,5) not null,
  hue numeric(6,5) not null,
  saturation numeric(6,5) not null,
  corrosion_level numeric(6,5) not null,
  crack_intensity numeric(6,5) not null,
  source_event_seq bigint not null,
  engine_version varchar(64) not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index if not exists uq_planet_runtime_state_scope
  on planet_runtime_state_rm(user_id, galaxy_id, table_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;
```

## 7. Profile coefficient catalog (v1)

`FORGE`
- `a=0.10 b=0.22 c=0.10 d=0.55 e=0.25 f=0.25 u=0.05 v=0.08 g=0.45 h=0.28 l0=0.26 p0=0.25`

`BALANCE`
- `a=0.08 b=0.14 c=0.14 d=0.40 e=0.20 f=0.30 u=0.07 v=0.07 g=0.35 h=0.22 l0=0.24 p0=0.20`

`ARCHIVE`
- `a=0.06 b=0.08 c=0.18 d=0.28 e=0.15 f=0.35 u=0.10 v=0.05 g=0.22 h=0.16 l0=0.22 p0=0.16`

## 8. Planet phase thresholds (v1)

Suggested defaults with hysteresis:
- `ACTIVE`: `activity >= 0.55`
- `OVERLOADED`: `stress >= 0.72`
- `DORMANT`: `activity <= 0.20 && inactivity >= 0.55`
- `CORRODING`: `corrosion >= 0.60`
- `CRITICAL`: `health <= 0.25 || (stress >= 0.85 && corrosion >= 0.65)`

Hysteresis margin: `0.05` around each threshold.

## 9. FE rendering contract

FE must treat backend runtime as authoritative:
1. scale <- `visual.size_factor`
2. emissive/glow <- `visual.luminosity`
3. pulse speed/amplitude <- `visual.pulse_rate`
4. color <- (`visual.hue`, `visual.saturation`)
5. corrosion materials <- `visual.corrosion_level`, `visual.crack_intensity`

FE is allowed to interpolate between snapshots for smooth animation only.

## 10. Lock and migration policy

After initial lock:
- no `PATCH` direct edits on constitution or physical coefficients.
- migration API only:
  - `POST /galaxies/{galaxy_id}/star-core/physics/profile/migrate`
  - payload includes `from_version`, `to_version`, `reason`, `dry_run`.

Dry-run returns projected impact summary per planet without applying.

## 11. Compatibility and rollout

1. Keep v1 star contract and endpoints active.
2. Introduce v2 fields as additive payload.
3. FE reads v2 when available, falls back to existing local resolver otherwise.
4. After stability gate, mark FE fallback path as deprecated.

## 12. Test matrix

## 12.1 Unit tests (BE)
- coefficient resolution by profile key/version,
- clamping guarantees on all formulas,
- monotonic checks:
  - `activity up => luminosity non-decrease` (holding other inputs),
  - `inactivity up => corrosion non-decrease`,
- deterministic replay (`same events => same runtime`).

## 12.2 Integration tests (BE)
- lock endpoint writes constitution + physical profile atomically,
- no post-lock mutable edit path,
- runtime endpoint returns state for branch and main timeline,
- migration dry-run does not mutate DB.

## 12.3 Contract tests (BE+FE)
- schema snapshot freeze for star v2 payload,
- FE parser/normalizer compatibility with missing optional fields,
- unknown phase fallback behavior.

## 12.4 UI behavior tests (FE)
- Stage 0 blocked before star lock,
- after lock, first planet flow enabled,
- runtime phase causes expected visual class/material switch,
- stale runtime snapshot gracefully interpolates/fallbacks.

## 12.5 Performance gates
- recompute batch of 500 planets under target SLA,
- no frame stalls in FE when receiving runtime updates,
- bounded payload size for runtime endpoint.

## 13. Security and audit

- All endpoints require user scope validation by galaxy ownership.
- All lock/migration actions produce audit events and include actor ID.
- No endpoint introduces hard-delete semantics.

## 14. Implementation checklist (engineering)

1. DB migration for `star_physics_profile` and `planet_runtime_state_rm`.
2. Service layer:
- profile catalog resolver,
- runtime engine update function,
- migration planner.
3. API layer:
- lock payload extension,
- profile/runtime endpoints.
4. FE layer:
- star dashboard profile card integration,
- runtime rendering adapter,
- fallback deprecation flag.
5. Test layer:
- unit + integration + contract + performance smoke.
