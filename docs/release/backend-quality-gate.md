# Backend Quality Gate

Date: 2026-03-04
Owner: BE

## Goal

Define one repeatable go/no-go gate so backend quality stays at parser-level rigor (deterministic semantics, stable contracts, no hard-delete regressions).

## Commands

- Quick gate (local before commit):
  - `make be-gate`
  - same as: `make be-gate-quick`
- Strict gate (before merge/release, requires running API):
  - `make be-gate-strict`

## Runtime hardening add-on gate (PRH-2/3/4)

Use this focused set when touching event-driven onboarding, outbox runtime, tracing, resilience, graceful shutdown, or DB read/write routing.

- PRH-2 onboarding event-driven flow:
  - `PYTHONPATH=. pytest -q tests/test_auth_onboarding_event_driven_flow.py tests/test_onboarding_bootstrap_consumer.py tests/test_auth_service_outbox.py`
- PRH-3 observability + outbox runtime:
  - `PYTHONPATH=. pytest -q tests/test_outbox_observability_logging.py tests/test_outbox_operator_service.py tests/test_outbox_relay_runner_service.py tests/test_outbox_relay_service.py`
  - `PYTHONPATH=. pytest -q tests/test_trace_context.py tests/test_trace_context_middleware.py tests/test_trace_coverage_endpoint_metric.py`
- PRH-3 resilience envelope:
  - `PYTHONPATH=. pytest -q tests/test_rate_limit_middleware.py tests/test_circuit_breaker.py tests/test_resilience_error_envelopes.py`
- PRH-4 graceful shutdown + DB routing:
  - `PYTHONPATH=. pytest -q tests/test_runtime_shutdown_service.py tests/test_db_router.py tests/test_db_read_write_routing_wiring.py`

Release close snapshot (recommended after multiple backend blocks):
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs`
- `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py -rs`

## Profiles

### `quick`

Runs:
- v1 safety policy (`scripts/release_v1_gate.sh`)
- compile check for all tracked Python files
- parser2 suite (`lexer/ast/planner/bridge/resolver/runtime/spec`)
- task executor + schema + IO error model tests
- calc/physics/projection/read-model tests
- auth/scope parity tests

### `strict`

Runs everything from `quick`, plus:
- API health check on `DATAVERSE_API_BASE` (default `http://127.0.0.1:8000`)
- full `tests/test_api_integration.py`

## Merge policy

- No backend PR should be merged if `make be-gate` fails.
- Changes touching API contracts, parser/executor path, or import semantics require `make be-gate-strict` green before release branch merge.
- Changes touching PRH-2/3/4 scope require relevant `Runtime hardening add-on gate` subset green before merge.

## Notes

- To target non-default API endpoint in strict profile:
  - `DATAVERSE_API_BASE=http://127.0.0.1:8001 make be-gate-strict`
