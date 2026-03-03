# Service Parity Audit (Parser Baseline)

Date: 2026-03-03
Scope: backend services behind parser and task execution path.
Goal: verify that parser throughput is not limited by weaker services and define next BE optimization stage.

## Verification snapshot

Executed tests:
- `pytest -q tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_bridge.py tests/test_task_executor_service_stage2.py tests/test_io_service_error_model.py tests/test_calc_engine_service.py tests/test_physics_engine_service.py tests/test_universe_projection_errors.py tests/test_api_integration.py`

Result:
- `68 passed, 64 skipped, 4 warnings`
- warnings are deprecations for `HTTP_422_UNPROCESSABLE_ENTITY` constant usage.

## Maturity matrix (re-audit)

Scale 1..5:
- 1 = ad-hoc
- 3 = reliable for normal path
- 5 = reference quality (contract-first, deterministic, modular)

| Area | Score | Evidence | Main gap |
|---|---:|---|---|
| Parser2 pipeline | 5 | `app/services/parser2/*`, deterministic bridge tests green | none critical |
| API orchestration/idempotency | 4 | shared `run_scoped_idempotent` in `app/main.py:378` | still endpoint-level shape duplication |
| Task executor | 4 | modular family handlers + OCC/contracts (`task_executor/*`) | full universe preload on every execute (`task_executor_service.py:1017`) |
| Import/Export service | 3 | typed row error classification | broad catch + duplicated failure finalization (`io_service.py:356-415`) |
| Universe projection | 3 | strict malformed event handling (`UNIVERSE_EVENT_PAYLOAD_INVALID`) | read path computes formulas in legacy way (`universe_service.py:479`) |
| Calc engine | 4 | FLOW-only + Decimal + deterministic errors | snapshot path does not consume calc read-model by default |
| Physics engine | 4 | persisted `physics_state_rm` projection | UI/read path still largely independent from persisted physics |
| Cosmos service | 4 | contracts/branch normalization and locking | scope resolver duplicated with auth service |
| Auth service | 3 | robust auth flow and password limits | duplicated galaxy scope logic (`auth_service.py:118`) |
| Read model projector | 4 | idempotent upserts + calc/physics projection | complexity high, limited dedicated perf tests |
| Legacy atom/bond services | 1 | explicitly deprecated | still present in codebase (maintenance noise) |

## Findings by severity

### High

1. Calc parity drift on read path
- `app/services/universe_service.py:479`
- `project_state(apply_calculations=True)` still computes formulas via `evaluate_universe` from live snapshot, while canonical calc projection is already in `calc_state_rm`.
- Risk: frontend can observe results that differ from calc engine projection pipeline, and BE does duplicate expensive computation.

2. Task executor has O(N) preload regardless of task scope
- `app/services/task_executor_service.py:1017`
- Every batch first loads full active asteroids+bonds map. For ID-targeted updates this is unnecessary and scales poorly with galaxy size.
- Risk: parser can produce small atomic intents, but executor latency grows with total graph size.

### Medium

3. Import service error handling contains duplicated branches and broad catch
- `app/services/io_service.py:356-415`
- Two almost identical failure branches and `except Exception` path.
- Risk: maintainability drift and weaker guarantees around classified error semantics.

4. Galaxy scope resolution duplicated in two services
- `app/services/auth_service.py:118`
- `app/services/cosmos_service.py:28`
- Risk: policy drift for access checks.

5. Deprecated HTTP constant still used widely
- multiple occurrences from `rg -n "HTTP_422_UNPROCESSABLE_ENTITY" app tests`
- Risk: warning noise now; future framework upgrade break risk.

## Stage 1 BE optimization backlog (next implementation slice)

### Stage 1A: Canonical read-path parity (Calc/Physics first)

Deliverables:
- For `branch_id is None` and `as_of is None`, make universe snapshot read calculated payload from `calc_state_rm` (and visual factors from `physics_state_rm` where available).
- Keep current in-memory `evaluate_universe` as fallback for branch replay and historical `as_of` timelines.

Definition of done:
- Main timeline snapshot no longer recomputes formulas from scratch.
- Same numbers between snapshot and calc projection tables.
- Add integration test asserting parity between `/universe/snapshot` and `calc_state_rm`.

### Stage 1B: Executor scoped preload strategy

Deliverables:
- Pre-scan batch tasks:
  - if all targets are explicit UUIDs, load only required asteroids + connected bonds.
  - fallback to full preload only for name/condition selectors (`SELECT`, `DELETE target`, parser-style fuzzy target).
- Preserve existing behavior for mixed batches.

Definition of done:
- No contract/OCC behavior change.
- Latency for ID-only batch is independent of total galaxy size.

### Stage 1C: Import error path hardening

Deliverables:
- Extract shared helper for row failure recording + strict finalization.
- Keep typed `ImportRowFailure` codes but remove duplicated exception branches.
- Replace broad `except Exception` with explicit classification path plus controlled fallback.

Definition of done:
- Same API response shape.
- Simpler code path with one failure finalization function.

### Stage 1D: Shared galaxy scope resolver

Deliverables:
- Move repeated "resolve user galaxy" logic to one shared service/helper and reuse from Auth/Cosmos/Main.

Definition of done:
- One canonical access check path.
- Existing auth/cosmos tests still green.

### Stage 1E: 422 constant migration

Deliverables:
- Replace `status.HTTP_422_UNPROCESSABLE_ENTITY` with `status.HTTP_422_UNPROCESSABLE_CONTENT` in app + tests.

Definition of done:
- No deprecation warnings in targeted service test suite.

## Recommended execution order

1. Stage 1E (quick hygiene)
2. Stage 1C (error model maintainability)
3. Stage 1B (executor latency)
4. Stage 1A (calc/physics parity, highest impact)
5. Stage 1D (scope cleanup)

Reasoning:
- 1E+1C are low-risk and clean up diagnostics first.
- 1B improves parser-facing write latency immediately.
- 1A is most important semantically, but touches read contracts and should land with dedicated tests.
- 1D is structural cleanup after behavior-critical changes are stable.
