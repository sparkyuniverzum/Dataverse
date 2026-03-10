# Session Handoff - 2026-03-10 (PRH-3 / PRH-4)

## Stav
- Backend runtime hardening blok PRH-3 + PRH-4 je stabilizovaný.
- Krátké i integrační gate proběhly zeleně.
- Skip v `tests/test_api_integration.py` je očekávaný:
  - `Bundle 'personal_cashflow' is not available in this environment.`

## Co je dokončeno
- PRH-3:
  - JSON structured logging contract (trace/correlation/module fields).
  - Resilience baseline (rate limiting + circuit breaker + envelope).
  - Request trace-context middleware + fallback do log contextu.
  - Volitelný OpenTelemetry bootstrap (safe fallback).
  - Light trace coverage metric test (`>=95%`).
- PRH-4:
  - DB read/write router abstraction (single-DB kompatibilní).
  - GET routing přes read-session u read-heavy routerů.
  - Graceful shutdown orchestrace:
    - stop intake
    - drain in-flight executor
    - outbox flush
    - DB pool dispose

## Poslední ověřený gate snapshot
- `PYTHONPATH=. pytest -q tests/test_trace_coverage_endpoint_metric.py` -> passed
- `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs` -> 99 passed, 1 skipped
- `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py -rs` -> 3 passed

## Co zbývá do dalšího sprintu
1. Frontend runner stabilita unit testů (`vitest` kolekce) - oddělený FE blok.
2. PRH hardening maintenance:
   - držet PRH-2/3/4 gate zelený v pravidelném release cyklu.

## Akční checklist (další navázání)
1. OTel operational close:
   - [x] přidat explicitní span wrapper pro outbox run endpoint + relay run
   - [x] dopsat integrační test na trace continuity v kritické trase
   - [x] zapsat env matice (`DATAVERSE_OTEL_ENABLED`, exporter strategy) do runbooku
2. PRH-2 close:
   - [x] potvrdit, že onboarding flow neobsahuje přímé sync cross-module volání
   - [x] přidat integrační test pro delayed consumer + duplicate delivery (pokud chybí poslední varianta)
3. Release docs close:
   - [x] aktualizovat `docs/release/v1-rollout-runbook.md`
   - [x] aktualizovat `docs/release/backend-quality-gate.md` o nové PRH-3/4 gate

## Closure update (2026-03-10)
- PRH-2 closure evidence:
  - `tests/test_auth_onboarding_event_driven_flow.py`
  - `tests/test_onboarding_bootstrap_consumer.py`
- PRH-3 closure evidence:
  - `tests/test_outbox_observability_logging.py`
  - `tests/test_trace_coverage_endpoint_metric.py`
- PRH-4 closure evidence:
  - `tests/test_runtime_shutdown_service.py`
  - `tests/test_db_router.py`
  - `tests/test_db_read_write_routing_wiring.py`

## Pravidla pro pokračování
- Nerozšiřovat monolity, dělit do focused služeb/middleware/helperů.
- Dlouhé e2e nespouštět po každém bloku; nejdřív krátké cílené testy.
- Po každém bloku:
  - implementace
  - krátké testy
  - přesné povely pro test run a commit.
