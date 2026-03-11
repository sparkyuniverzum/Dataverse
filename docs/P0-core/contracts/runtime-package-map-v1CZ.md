# Runtime Package Mapa v1

Status: active
Datum: 2026-03-11
Scope: vlastnictví backend runtime balíčků po infrastructure cleanupu

## 1. Co se změnilo

- [x] 2026-03-11 Cross-cutting runtime utility jsou kanonicky v `app/infrastructure/runtime/observability/*`.
- [x] 2026-03-11 Runtime enginy jsou kanonicky v `app/infrastructure/runtime/*` (event store, idempotency, advisory lock, outbox, parser, parser2).
- [x] 2026-03-11 Legacy service-level compatibility shimy pro tyto utility byly odstraněny z `app/services/*`.

## 2. Proč se to změnilo

- [x] 2026-03-11 Restart mode vyžaduje jednu kanonickou package mapu.
- [x] 2026-03-11 Runtime infrastruktura musí být importně stabilní a snadno dohledatelná pro další cleanup domén.
- [x] 2026-03-11 Duální import cesty (`app/services/*` vs `app/infrastructure/runtime/*`) jsou zdroj regresí a nejasností.

## 3. Kanonická mapa

### 3.1 Runtime enginy

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

### 3.3 Záměrně ponechaná compatibility facade

- `app/core/parser2/*` zůstává jako compatibility facade s explicitními module proxy na parser2 implementaci v infrastruktuře.

### 3.4 Odstraněné legacy shim cesty

- `app/services/circuit_breaker.py`
- `app/services/trace_context.py`
- `app/services/logging_helpers.py`
- `app/services/telemetry_spans.py`
- `app/services/parser_service.py`
- `app/services/task_executor_service.py`

## 4. Import policy

- Runtime utility importy musí používat `app.infrastructure.runtime.*`.
- Nový kód nesmí importovat odstraněné shim moduly z `app.services.*`.
- Doménové/business moduly mohou runtime služby používat přes app-factory wiring, ale import cesty zůstávají infrastructure-canonical.

## 5. Důkazy

- [x] 2026-03-11 Lokální statické kontroly prošly v implementačním bloku:
  - `python -m py_compile ...` na dotčených runtime/docs-adjacent souborech
  - `ruff check ...`
  - `ruff format --check ...`
- [x] 2026-03-11 Focused test blok prošel (spuštěno uživatelem):
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

## 6. Otevřené položky

- [ ] Spustit plný hardening gate: `pytest -q tests/test_api_integration.py`
