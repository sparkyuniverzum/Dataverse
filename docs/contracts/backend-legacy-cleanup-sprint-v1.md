# Backend Legacy Cleanup Sprint v1

Status: in progress
Date: 2026-03-10
Owner: Backend Runtime
Depends on:
- `docs/contracts/platform-runtime-hardening-sprint-plan-v1.md`
- `docs/contracts/parser-v2-spec.md`
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`

Execution log:
- [x] 2026-03-10: `CLC-1` parser boundary cleanup completed; parser v2 namespace made canonical, legacy parser kept behind compatibility shim.
- [x] 2026-03-10: `CLC-2` task executor package normalization completed; executor moved under `app/services/task_executor/` with top-level shims preserved.
- [x] 2026-03-10: `CLC-3` outbox package consolidation completed; outbox roles moved under `app/services/outbox/` with top-level shims preserved.
- [x] 2026-03-10: `CLC-4` projection naming cleanup completed; SQL read-model projector moved under `app/services/projection/` and universe read-model rebuild renamed to `runtime_projection_from_read_models.py`.
- [x] 2026-03-10: `CLC-5` galaxy router package cleanup completed; route modules moved under `app/api/routers/galaxies/` and shared scope resolution centralized in `deps.py`.
- [ ] next: cleanup sprint complete, follow-up block should remove compatibility shims only after broader regression gate if desired

Evidence:
- `CLC-2`: `pytest -q tests/test_task_executor_service_stage2.py tests/test_task_batch_execution_service.py tests/test_runtime_shutdown_service.py` -> `23 passed in 5.47s`
- `CLC-3`: `PYTHONPATH=. pytest -q tests/test_outbox_relay_service.py tests/test_outbox_relay_runner_service.py tests/test_outbox_operator_service.py tests/test_outbox_relay_consumer_dispatch.py tests/test_outbox_observability_logging.py` -> `14 passed in 5.94s`
- `CLC-3`: `PYTHONPATH=. pytest -q tests/test_auth_onboarding_event_driven_flow.py` -> `1 passed in 7.69s` (`passlib` deprecation warning only)
- `CLC-4`: `PYTHONPATH=. pytest -q tests/test_read_model_projector.py tests/test_universe_read_model_consistency.py` -> `4 passed in 3.01s`
- `CLC-4`: `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "snapshot or bonds or bridge_integrity"` -> `11 skipped, 89 deselected in 2.09s`
- `CLC-5`: `PYTHONPATH=. pytest -q tests/test_db_read_write_routing_wiring.py` -> `3 passed in 4.79s` (`passlib` deprecation warning only)
- `CLC-5`: `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "galaxies or onboarding or star_core"` -> `3 skipped, 97 deselected in 1.07s`

## 1. Goal

Remove naming ambiguity and legacy structural noise in backend runtime without changing user-visible behavior.

Primary rule:
1. no big-bang delete
2. no monolith expansion
3. move toward package boundaries first, then remove compatibility shims

## 2. Validated Findings

### 2.1 Parser layer

Validated state:
1. `app/services/parser2/` is the new canonical parser/planner stack.
2. `app/services/parser_service.py` is still actively used as:
   - legacy parser implementation
   - owner of `AtomicTask`
   - fallback path from `parser_command_service.py`
   - import source for multiple API/services/tests
3. `app/services/parser_command_service.py` is not a second parser. It is orchestration glue between parser v2, resolver, fallback policy, and v1 compatibility.

Conclusion:
- do not delete `parser_service.py` immediately
- first extract shared task types and isolate legacy parser behind an explicit compatibility boundary

### 2.2 Task executor layer

Validated state:
1. `app/services/task_executor_service.py` is still the runtime orchestrator used by app factory and execution paths.
2. `app/services/task_executor/` is not a duplicate executor; it already contains extracted submodules (`handlers`, `families`, `occ_guards`, `contract_validation`, `target_resolution`).
3. The current problem is not "two executors" but one large orchestrator file plus a partially extracted package around it.
4. `app/services/task_batch_execution_service.py` is only a small preview helper and should not remain top-level.

Conclusion:
- do not remove `task_executor_service.py` before moving orchestrator into package form
- refactor by package normalization, then compatibility shim removal

### 2.3 Projection layer

Validated state:
1. `app/services/read_model_projector.py` projects immutable events into mutable SQL read-model tables.
2. `app/services/universe/event_projection.py` projects event streams into in-memory runtime state.
3. `app/services/universe/read_model_projection.py` rebuilds universe runtime view from existing SQL read models.

Conclusion:
- this is not true duplication
- current issue is naming ambiguity between "read model projector" and "read model projection"
- solve with naming/package cleanup, not deletion

### 2.4 Galaxy routers

Validated state:
1. `app/api/routers/galaxies.py` is already just an aggregator.
2. The split files (`core`, `dashboard`, `onboarding`, `star_core`, `stream`) reflect separate concerns.
3. The actual smell is repeated dependency/scope plumbing, not file count alone.

Conclusion:
- do not collapse all galaxy routes into one large router file
- introduce `routers/galaxies/` package with shared dependency helpers instead

### 2.5 Outbox layer

Validated state:
1. `outbox_operator_service.py` = operator-facing orchestration and circuit-breaker wrapper
2. `outbox_relay_runner_service.py` = one run loop orchestration (`requeue + relay_pending`)
3. `outbox_relay_service.py` = relay domain logic and state transitions
4. `outbox_publisher_service.py` = publisher adapter

Conclusion:
- this is not spaghetti duplication
- current problem is top-level fragmentation and naming spread
- solve by moving into `app/services/outbox/` package, keeping roles explicit

## 3. Cleanup Strategy

### 3.1 P0: parser boundary cleanup

Target:
- make `parser2` canonical
- keep v1 only as explicit compatibility adapter

Implementation:
1. Extract `AtomicTask` and parse result shared types from `parser_service.py` into `app/services/parser_types.py` or `app/services/parser/types.py`.
2. Rename `parser_service.py` to `parser_legacy_service.py` behind a temporary compatibility shim.
3. Rename `parser_command_service.py` to `parser_orchestration_service.py` or move it into `app/services/parser/command_resolution.py`.
4. Update imports in routers/services/tests to shared types module.
5. Add runtime flag doc that defines exactly when v1 fallback is allowed.

Exit criteria:
1. `parser2` is the only canonical parser namespace.
2. v1 parser is visibly marked as legacy compatibility.
3. shared task types no longer live inside legacy parser module.

Suggested focused gates:
- `PYTHONPATH=. pytest -q tests/test_parser_service.py tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_resolver.py tests/test_parser2_bridge.py tests/test_parser2_runtime_flags.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "parser_plan or set_formula"`

### 3.2 P0: task executor package normalization

Target:
- keep one executor, but move it fully under package boundary

Implementation:
1. Create `app/services/task_executor/service.py` and move `TaskExecutorService` there.
2. Move `TaskExecutionResult` and execution dataclasses into `app/services/task_executor/models.py`.
3. Move `task_batch_execution_service.py` preview helper into `app/services/task_executor/preview.py`.
4. Keep temporary top-level shims:
   - `task_executor_service.py`
   - `task_batch_execution_service.py`
5. After import migration, remove top-level shims in a later block.

Exit criteria:
1. canonical executor imports come from `app.services.task_executor.*`.
2. top-level files become temporary compatibility wrappers only.
3. no new logic lands in top-level executor files.

Suggested focused gates:
- `PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py tests/test_task_batch_execution_service.py tests/test_runtime_shutdown_service.py`
- `PYTHONPATH=. pytest -q tests/test_api_runtime.py tests/test_api_integration.py -k "ingest or extinguish or batch"`

### 3.3 P1: projection naming cleanup

Target:
- make event->RM projection and universe runtime projection impossible to confuse

Implementation:
1. Move `read_model_projector.py` into package `app/services/projection/read_model_projector.py` or `app/services/read_models/projector.py`.
2. Keep `app/services/universe/event_projection.py` as runtime event projection.
3. Rename `app/services/universe/read_model_projection.py` to `runtime_projection_from_read_models.py`.
4. Update `UniverseService` imports and tests.
5. Add short README/doc note describing the 3 projection modes.

Exit criteria:
1. names clearly distinguish SQL read-model projection vs universe runtime reconstruction.
2. no engineer has to guess where to add a new event handler.

Suggested focused gates:
- `PYTHONPATH=. pytest -q tests/test_read_model_projector.py tests/test_universe_read_model_consistency.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "snapshot or bonds or bridge_integrity"`

### 3.4 P1: galaxy router package cleanup

Target:
- preserve separation of concerns without top-level file sprawl

Implementation:
1. Create package `app/api/routers/galaxies/`.
2. Move files to:
   - `core.py`
   - `dashboard.py`
   - `onboarding.py`
   - `star_core.py`
   - `stream.py`
   - `deps.py` for shared scope/dependency helpers
3. Keep `app/api/routers/galaxies.py` as thin aggregator shim.
4. Remove repeated `_resolve_scope` and repeated dependency wiring where possible.

Exit criteria:
1. galaxy routing remains split by concern.
2. shared dependency and scope logic is centralized.
3. top-level routers dir is flatter and easier to scan.

Suggested focused gates:
- `PYTHONPATH=. pytest -q tests/test_db_read_write_routing_wiring.py`
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -k "galaxies or onboarding or star_core"`

### 3.5 P1: outbox package consolidation

Target:
- preserve the 4 valid roles, but group them into one coherent module

Implementation:
1. Create `app/services/outbox/` package.
2. Move files to:
   - `operator.py`
   - `runner.py`
   - `relay.py`
   - `publisher.py`
3. Keep temporary top-level import shims until all imports are migrated.
4. Re-export canonical names in `app/services/outbox/__init__.py`.
5. Update `app_factory.py`, runtime shutdown, star core router, and tests to package imports.

Exit criteria:
1. outbox concepts are grouped under one namespace.
2. top-level `services/` no longer looks fragmented.
3. no behavioral change in relay/operator semantics.

Suggested focused gates:
- `PYTHONPATH=. pytest -q tests/test_outbox_relay_service.py tests/test_outbox_relay_runner_service.py tests/test_outbox_operator_service.py tests/test_outbox_relay_consumer_dispatch.py tests/test_outbox_observability_logging.py`
- `PYTHONPATH=. pytest -q tests/test_auth_onboarding_event_driven_flow.py tests/test_star_core_integration_freeze.py`

## 4. Execution Order

Recommended order:
1. `CLC-1` parser boundary cleanup
2. `CLC-2` task executor package normalization
3. `CLC-3` outbox package consolidation
4. `CLC-4` projection naming cleanup
5. `CLC-5` galaxy router package cleanup

Reasoning:
1. parser and executor are true source-of-truth confusion with runtime blast radius.
2. outbox package cleanup is mostly namespace cleanup and lower behavior risk.
3. projection cleanup must be naming-safe and should happen after executor namespace stabilizes.
4. router cleanup is mostly packaging and can safely come last.

## 5. Explicit Non-Goals

1. Do not remove parser v1 fallback in the same block as type extraction.
2. Do not rewrite executor behavior while moving files.
3. Do not merge all galaxy routes into one file.
4. Do not collapse outbox roles into one god service.
5. Do not change API contracts during namespace cleanup blocks.

## 6. Recommended Block Cadence

For each block:
1. move code under canonical package
2. keep compatibility shim
3. migrate imports
4. run focused gates
5. then remove shim in a separate block if everything stays green

## 7. Release-Style Regression After Major Cleanup Block

Backend:
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs`
- `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py -rs`

Frontend sanity after backend cleanup touching contracts:
- `npm --prefix frontend run test:e2e:workspace-starlock`
- `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
- `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`

## 8. Decision Summary

Correct actions:
1. parser cleanup
2. executor package normalization
3. outbox package consolidation
4. galaxy router package cleanup by subpackage, not by merge
5. projection naming cleanup

Incorrect actions:
1. deleting `parser_service.py` immediately
2. deleting `task_executor_service.py` before package migration
3. treating universe projection modules and SQL projector as the same thing
4. collapsing all galaxy routers into one file
5. collapsing all outbox roles into one service
