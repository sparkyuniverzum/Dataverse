# DataVerse Service Maturity Matrix v1

Status: audit baseline  
Date: 2026-03-03  
Goal: align all backend services to parser-level engineering quality so parser throughput is not limited by weaker layers.

## Scope

Reviewed modules:
- `app/services/parser2/*`
- `app/services/task_executor_service.py`
- `app/services/io_service.py`
- `app/services/cosmos_service.py`
- `app/services/universe_service.py`
- `app/services/read_model_projector.py`
- `app/services/idempotency_service.py`
- `app/services/auth_service.py`
- API orchestration in `app/main.py`
- legacy `atom_service.py` and `bond_service.py`

## Maturity rubric

Scale `1..5`:
- `1`: ad-hoc logic, missing invariants, weak tests.
- `2`: basic correctness, partial invariants, limited observability.
- `3`: reliable in normal path, some duplication or drift risk.
- `4`: modular, deterministic, tested on edge cases.
- `5`: reference quality (contract-first, deterministic, composable, high test density).

## Matrix

| Area | Score | Strengths | Gaps / Risk |
|---|---:|---|---|
| Parser2 lexer/AST/planner/bridge | 5 | clear phase separation, deterministic error model, intent pipeline | none critical |
| Task executor | 4 | OCC, contract checks, advisory locks, strong domain guards | oversized monolith (`execute_tasks`) slows evolvability |
| API command endpoints in `main.py` | 2 | consistent security scope, idempotency wired | heavy duplication of same orchestration patterns; high drift risk |
| Idempotency service | 4 | deterministic payload hash, replay lock, conflict handling | no major blocker |
| Cosmos service (branches/contracts) | 4 | user/galaxy scoping, versioned contracts, normalization | growing domain breadth, needs bounded modules |
| Universe projection service | 3 | dual projection path, access checks, deterministic derivations | contains broad exception swallow in event decode path |
| Read model projector | 4 | idempotent upserts, rollup refresh, payload validation | limited dedicated tests vs complexity |
| Import/Export service | 3 | per-row tx model, strict/lenient modes, job/error tracking | broad `except Exception` flattens domain errors |
| Auth service | 4 | explicit password constraints, clean JWT flow | small shared-scope duplication with cosmos resolver patterns |
| Legacy atom/bond services | 1 | none for current architecture | unused and below current standard; conceptual debt |

## Critical findings (blockers first)

1. API orchestration duplication is the main systemic risk.
- `ingest/mutate/extinguish/link` endpoints repeat near-identical idempotency+scope+executor flow.
- locations: `app/main.py:1080`, `app/main.py:1162`, `app/main.py:1268`, `app/main.py:1367`, `app/main.py:1474`, `app/main.py:1573`.
- impact: parser can evolve faster than endpoint wrappers, causing behavioral divergence.

2. Task executor is functionally strong but structurally too large.
- location: `app/services/task_executor_service.py:520`.
- impact: high regression risk when adding new intent/task kinds; difficult targeted tests.

3. Import service uses broad catch for row execution.
- location: `app/services/io_service.py:291`.
- impact: domain error semantics (e.g., OCC/contract) are collapsed into generic import row error strings.

4. Legacy services are below standard and not part of active architecture.
- locations: `app/services/atom_service.py:13`, `app/services/bond_service.py:13`.
- impact: ambiguity for contributors, accidental reuse of outdated path.

5. Universe event projection has exception-swallowing branch.
- location: `app/services/universe_service.py:152`.
- impact: malformed payloads can be silently ignored, reducing diagnosability.

## Service parity target

Minimum standard for all write-path services:
- deterministic error taxonomy (no generic catch unless rethrow with typed domain error).
- explicit scope resolution (`user_id + galaxy_id + branch_id`) centralized in one reusable layer.
- OCC and idempotency applied through one orchestrator path.
- composable modules with single responsibility.
- focused unit tests per module plus integration contract tests.

## Refactor plan (3 stages)

### Stage 1: API orchestration consolidation (highest ROI)

Deliverables:
- introduce shared command execution facade for endpoint handlers:
  - resolve scope
  - idempotency replay/store
  - executor invocation
  - uniform response assembly
- migrate endpoints `/asteroids/*`, `/bonds/*`, `/parser/execute`, `/tasks/execute-batch` to the facade.

Definition of done:
- remove duplicated idempotency blocks from endpoint handlers.
- keep API contract behavior unchanged.
- integration tests for idempotency/OCC pass unchanged.

### Stage 2: Task executor modular split

Deliverables:
- split `execute_tasks` by action families:
  - ingest/update
  - link/bond mutation
  - extinguish flows
  - formula/guardian/select
- isolate shared helpers into internal modules (`target resolution`, `contract validation`, `occ guards`).

Definition of done:
- `task_executor_service.py` reduced to orchestration shell.
- action handlers have dedicated unit tests.
- no behavioral drift in parser integration tests.

Status (2026-03-03):
- implemented
- internal helper modules added:
  - `app/services/task_executor/target_resolution.py`
  - `app/services/task_executor/contract_validation.py`
  - `app/services/task_executor/occ_guards.py`
- executor action loop split into family handlers:
  - ingest/update
  - link/bond mutation
  - extinguish flows
  - formula/guardian/select
- dedicated unit tests added:
  - `tests/test_task_executor_service_stage2.py`

### Stage 3: Error model hardening + legacy cleanup

Deliverables:
- replace broad catches in import path with typed mapping (`HTTPException`, validation errors, unexpected internal).
- add structured error code in import row error payload.
- deprecate/remove legacy `atom_service` and `bond_service` from active architecture docs and imports.
- tighten projection error handling where payload decode currently swallows exceptions.

Definition of done:
- no broad `except Exception` in core write paths without explicit reclassification.
- legacy service path either removed or explicitly marked internal-deprecated and unreferenced.
- docs and contracts reflect only active command path.

## Test strategy upgrade

Add/expand tests for parity with parser rigor:
- unit tests for each executor action handler after split.
- unit tests for orchestration facade idempotency branches.
- import service tests asserting typed row error codes.
- projector/universe malformed payload tests (no silent drop without traceable reason).

## Priority order

1. Stage 1
2. Stage 2
3. Stage 3

This order minimizes parser bottlenecks fastest while keeping behavior stable.
