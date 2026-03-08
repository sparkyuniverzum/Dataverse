# Dataverse Architecture Direction v1

Status: approved direction baseline
Owner: Core BE/FE architecture
Date: 2026-03-05

## 1) Purpose
This document defines the target direction for the Planet-centric Dataverse model and the implementation order.
It is the source of truth for BE/FE alignment, including complete synchronization with Grid.

## 2) Core Principle
Planet is the primary domain aggregate.
It is not only a visual object, but a governed data boundary with strict lifecycle rules and deterministic projections.

Narrative layer (Planet, Moon, Bridge, Flow) is UX language.
System layer remains strict technical model:
- Planet = table aggregate
- Moon (resident) = row
- Bridge = relation edge
- Moon (dictionary body) = reference set / lookup dataset
- Laws = table contract
- Timeline = event stream + snapshots

## 3) Planet Domain Contract
Planet has:
- `table_id` (stable identity)
- `table_name` (logical name)
- `archetype` (`catalog|stream|junction`)
- `contract_version`
- `schema_fields`, `formula_fields`
- `sector` (`center,size,mode,grid_plate`)

Planet lifecycle rules:
- Create allowed only on main timeline.
- Soft extinguish only (no hard delete of data history).
- Extinguish is allowed only if planet is empty (no residents, no internal/external bonds).
- Contract versions are immutable history; latest active contract is authoritative.

## 4) Global Invariants
- No hard delete for domain residents and bonds.
- Every mutating operation is tenant scoped (`user_id + galaxy_id + branch scope`).
- Idempotency and OCC are first class for write paths.
- Main timeline read-model consistency must be strong within transaction boundary.
- Branch timeline is replay-driven and can diverge until promote.

## 5) Archetype Semantics
### Catalog
- Long-lived entities with stable identity.
- Typical behavior: upsert + mutate.
- Quality focus: integrity and controlled schema evolution.

### Stream
- High-frequency transactional flow.
- Typical behavior: append-first semantics, immutable history preference.
- Quality focus: ordering, throughput, timeline correctness.

### Junction
- Explicit linking/allocation records between entities.
- Typical behavior: graph bridge logic and cardinality enforcement.
- Quality focus: referential integrity and allocation correctness.

## 6) Complete Planet <-> Grid Synchronization
This is mandatory for MVP and all next layers.

### 6.1 Contract of synchronization
Grid must never run on a hidden custom model.
Grid uses the same projected source as Planet detail:
- `GET /planets/{table_id}`
- `GET /universe/tables`
- `GET /universe/snapshot`
- stream updates from SSE (`/galaxies/{galaxy_id}/events/stream`)

### 6.2 Deterministic mapping
Planet state -> Grid state:
- `members` -> Grid rows
- `schema_fields` -> Grid columns baseline
- `formula_fields` -> computed columns markers
- `contract_version` -> schema badge/version lock
- `archetype` -> grid mode profile

Grid actions -> Planet mutations:
- row insert/update/extinguish -> task executor / asteroid endpoints
- relation create/update/extinguish -> bond endpoints
- schema updates -> contract upsert/versioned contract changes

### 6.3 Write acknowledgement model
- FE writes optimistic update with pending state.
- BE returns authoritative projection payload.
- FE reconciles by `table_id`, `row id`, `current_event_seq`.
- Any mismatch triggers soft refresh from `GET /planets/{table_id}`.

### 6.4 Conflict and replay policy
- OCC conflict (`409`) is not hidden.
- FE shows deterministic conflict state and requests fresh projection.
- Replay from SSE is source of truth for converging local UI state.

### 6.5 DOD for sync
Planet-Grid sync is done when:
- no stale row after write + stream replay
- no phantom row after soft extinguish
- schema version displayed and respected in grid edits
- filters/sorts do not break after incremental stream updates
- reconnect/reload restores identical state from projections

### 6.6 Runtime sync loop (mandatory)
Client loop for one selected Planet:
1) bootstrap
- read `GET /universe/snapshot` + `GET /universe/tables` in one cycle
- derive selected table and grid rows from the same payload generation
2) write
- send write with `idempotency_key` and optional OCC guard
- mark row/edge as pending locally
3) commit ack
- on success, reconcile from response payload
- do not finalize local pending until sequence catches up
4) stream converge
- subscribe `GET /galaxies/{galaxy_id}/events/stream`
- consume `ready/update/keepalive`
- for `update`, refresh from projection sources (`snapshot + tables`)
5) drift recovery
- if OCC conflict, parser/validator error, sequence gap, reconnect, or stale selection:
- perform hard refresh of both payloads, clear pending queue, re-bind Grid selection by `table_id`

### 6.7 Ownership boundaries
- Planet service is owner of lifecycle and schema contract.
- Universe projection is owner of row/edge shape used by Grid.
- Grid never computes hidden schema from ad-hoc local state.
- FE store may cache, but source of truth is always BE projection + stream.

## 7) Visual Mapping Rules (Data Driven)
Visual behavior must be read-model driven, not ad-hoc from raw live tables.

Minimum mapping:
- `scale` <- residents count with bounded log scaling
- `luminosity` <- write frequency window
- `integrity_color` <- quality score / null/duplicate pressure
- `bridge_thickness` <- cardinality class
- `particle_rate` <- relation activity

All formulas must be deterministic and documented in code constants.

## 8) Timeline Model
- Event sourcing is baseline.
- Time travel must use snapshot + delta replay (not full replay by default).
- Timeline scrubber must project consistent Planet + Grid pair for same timestamp.

## 9) API Surface for Planet MVP
Mandatory endpoints:
- `POST /planets`
- `GET /planets`
- `GET /planets/{table_id}`
- `PATCH /planets/{table_id}/extinguish`
- `GET /presets/catalog` (stage-aware unlock)

Supporting endpoints:
- `GET /universe/tables`
- `GET /universe/snapshot`
- `GET /galaxies/{galaxy_id}/events/stream`
- contract, asteroid, bond, task batch endpoints

## 10) Layered Delivery Plan
### Layer A: Data core and governance
- Planet invariants, contract lifecycle, Moon/Bridge hard constraints.
- Done criteria: correctness and conflict safety.

### Layer B: Projection and visual contracts
- stable read models for Planet and Grid, deterministic visual mapping payload.
- Done criteria: no projection drift.

### Layer C: Interaction model
- DnD, setup flows, guided assembly, conflict handling UX.
- Done criteria: user can complete first Planet without text typing.

### Layer D: Timeline and simulation
- time travel mode and replay optimization.
- Done criteria: reproducible historical state.

## 11) Non-Goals for current cycle
- Full physics simulation fidelity.
- Unlimited custom renderer behavior per archetype.
- Replacing core event model with ad-hoc direct SQL writes.

## 12) Immediate Execution Checklist
- Keep Planet API as single source for workspace-level planet operations.
- Keep Universe tables projection compatible with empty planets.
- Keep preset unlock computed on BE (onboarding stage aware).
- Add FE integration tests for Planet <-> Grid convergence on write and stream replay.
