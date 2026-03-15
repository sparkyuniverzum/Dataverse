# Kontrakt: Backend Výkonnostní Gate (MVP)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Backend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje minimální výkonnostní a stabilitní kritéria (MVP Performance Gate) pro Backend systému Dataverse. Účelem je zabránit regresi v kritických runtime cestách (Event Sourcing, Projection Replay, Idempotency) před uvolněním změn do produkčního prostředí.

## 2. Technická Specifikace (Scope)
Gate pokrývá kritické operace, u kterých vysoká systémová složitost představuje riziko pro operátorskou použitelnost:
- **Parser Pipeline**: `preview` / `execute` flow.
- **Row Mutate Flow**: Operace nad `/civilizations*`.
- **Batch Execution**: Hromadné zpracování úloh přes `/tasks/execute-batch`.
- **Branch Lifecycle**: Operace `create`, `promote` a `close`.
- **Read-Model Consistency**: Konvergence projekcí a integrita datových modelů.

## 3. Pravidla a Výkonnostní Limity

### 3.1 Stabilita a Determinismus
- **Nulová tolerance 5xx**: V rámci gate sady nesmí dojít k neočekávaným serverovým chybám.
- **Idempotency Integrity**: Replay operace musí vracet identický payload (nulový payload drift).
- **Parser Enforcement**: Kontrola `preview_token` nesmí negativně ovlivnit funkční flow.

### 3.2 Latency Budget (Lokální Hardening Baseline)
| Oblast | Limit (s) |
| :--- | :--- |
| Parser sada (preview, execute, aliases) | 20.0 |
| Branch + Contracts + Star Core sada | 25.0 |
| Projection + Read-Model sada | 15.0 |
| Individuální test (limitní duration) | 3.0 |

## 4. Akceptační kritéria (Hard Gates)
- [ ] Všechny automatizované výkonnostní testy vrací status `OK`.
- [ ] Žádný požadavek v rámci sady nezpůsobí `500 Internal Server Error`.
- [ ] Celkový čas běhu jednotlivých sad nepřekračuje definovaný budget.
- [ ] Výsledky jsou evidovány v hardening logu s příslušným hash commitu.

## 5. Exekuční sada (Prověření)
```bash
# Parser & API Integration Gate
PYTHONPATH=. pytest -q tests/test_parser_preview_gate.py tests/test_parser_aliases_service.py tests/test_parser_command_service.py -rs --durations=10
# Core Operations Gate
PYTHONPATH=. pytest -q tests/test_api_integration.py::test_parser_preview_returns_plan_scope_risk_and_expected_events \
  tests/test_api_integration.py::test_parser_execute_accepts_valid_preview_token \
  tests/test_api_integration.py::test_branch_promote_replays_with_idempotency_key \
  tests/test_api_integration.py::test_table_contract_upsert_replays_with_idempotency_key \
  tests/test_api_integration.py::test_star_core_mvp_endpoints_return_policy_runtime_and_pulse -rs --durations=10
# Consistency Gate
PYTHONPATH=. pytest -q tests/test_universe_read_model_consistency.py tests/test_universe_projection_errors.py -rs --durations=10
```
