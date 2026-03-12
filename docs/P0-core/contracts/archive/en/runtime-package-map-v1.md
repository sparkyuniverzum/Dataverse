# Runtime Package Map v1

Status: archived historical mirror (inactive reference)
Date: 2026-03-11
Scope: backend runtime package ownership after infrastructure cleanup

## 1. What changed

- [x] 2026-03-11 Cross-cutting runtime utilities are canonical in `app/infrastructure/runtime/observability/*`.
- [x] 2026-03-11 Runtime engines are canonical in `app/infrastructure/runtime/*` (event store, idempotency, advisory lock, outbox, parser, parser2).
- [x] 2026-03-11 Legacy service-level compatibility shims for these utilities were removed from `app/services/*`.

## 2. Why it changed

- [x] 2026-03-11 One canonical package map is required for restart mode.
- [x] 2026-03-11 Runtime infrastructure must be import-stable and discoverable for future domain cleanup.
- [x] 2026-03-11 Duplicate import paths (`app/services/*` vs `app/infrastructure/runtime/*`) are a source of regressions and ambiguity.

## 3. Canonical map

### 3.1 Runtime engines

- `app/infrastructure/runtime/event_store_service.py`
- `app/infrastructure/runtime/idempotency_service.py`
- `app/infrastructure/runtime/db_advisory_lock.py`
- `app/infrastructure/runtime/outbox/*`
- `app/infrastructure/runtime/parser/*`
- `app/infrastructure/runtime/parser2/*`

### 3.2 Cross-cutting observability

- `app/infrastructure/runtime/observability/circuit_breaker.py`
- `app/infrastructure/runtime/observability/trace_context.py`
- `app/infrastructure/runtime/observability/logging_helpers.py`
- `app/infrastructure/runtime/observability/telemetry_spans.py`

### 3.3 Compatibility facade intentionally kept

- `app/core/parser2/*` remains a compatibility facade with explicit module proxies to infrastructure parser2 implementation.

### 3.4 Removed legacy shim paths

- `app/services/circuit_breaker.py`
- `app/services/trace_context.py`
- `app/services/logging_helpers.py`
- `app/services/telemetry_spans.py`
- `app/services/parser_service.py`
- `app/services/task_executor_service.py`

## 4. Import policy

- Runtime utility imports must use `app.infrastructure.runtime.*`.
- New code must not import removed shim modules from `app.services.*`.
- Domain/business modules may consume runtime services through app-factory wiring, but import paths remain infrastructure-canonical.

## 5. Evidence

- [x] 2026-03-11 Local static checks passed during implementation block:
  - `python -m py_compile ...` on touched runtime/docs-adjacent files
  - `ruff check ...`
  - `ruff format --check ...`
- [x] 2026-03-11 Focused test block passed (executed by user):
  - `tests/test_circuit_breaker.py`
  - `tests/test_trace_context.py`
  - `tests/test_telemetry_spans.py`
  - `tests/test_logging_json_formatter.py`
  - `tests/test_trace_context_middleware.py`
  - `tests/test_outbox_operator_service.py`
  - `tests/test_outbox_observability_logging.py`
  - `tests/test_outbox_relay_service.py`
  - `tests/test_outbox_relay_runner_service.py`
  - `tests/test_parser_service.py`
  - `tests/test_domain_professional_setup.py::test_runtime_cross_cutting_utilities_use_infrastructure_paths`
  - `tests/test_api_integration.py::test_star_core_mvp_endpoints_return_policy_runtime_and_pulse`

## 6. Remaining open items

- [x] 2026-03-11 Full hardening gate passed: `pytest -q tests/test_api_integration.py` -> `100 passed, 1 skipped`
