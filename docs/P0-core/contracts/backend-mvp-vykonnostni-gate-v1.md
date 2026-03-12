# Backend MVP výkonnostní gate v1

Stav: aktivní (MVP úroveň)
Datum: 2026-03-12
Vlastník: Core BE architektura

## 1. Proč je gate potřeba

Backend má vysokou systémovou složitost (`event sourcing`, `projection replay`, `idempotency`, parser `preview/execute` gate, branch timeline). Bez minimálního výkonového gate hrozí, že funkčně správná změna rozbije operátorskou použitelnost.

Tento dokument zavádí pouze MVP výkonový gate, ne finální scale/perf certifikaci.

## 2. Scope (MVP)

Gate pokrývá pouze klíčové runtime cesty:

1. parser `preview/execute`,
2. row mutate flow (`/civilizations*`),
3. batch execution (`/tasks/execute-batch`),
4. branch lifecycle (`create/promote/close`),
5. read-model/projection konzistenci.

Mimo scope:

1. horizontální škálování,
2. multi-node benchmarky,
3. FE render výkon.

## 3. MVP výkonová kritéria

## 3.1 Stabilita

1. V gate sadě nesmí být neočekávané `5xx`.
2. Idempotency replay musí vracet deterministickou odpověď (žádný payload drift).
3. Parser `preview_token` enforcement nesmí přidat regresi funkčního flow.

## 3.2 Latency budget (MVP, lokální hardening baseline)

1. Cílená parser sada (`preview/execute/aliases`) musí doběhnout do 20 s.
2. Cílená branch + contracts + star-core sada musí doběhnout do 25 s.
3. Cílená projection/read-model sada musí doběhnout do 15 s.
4. Jednotlivý test v těchto sadách by neměl dlouhodobě překračovat ~3 s (`--durations` kontrola).

Poznámka:
Jde o MVP provozní budget pro lokální release gate, ne o produkční SLO.

## 4. Gate sada (copy/paste)

```bash
cd /mnt/c/Projekty/Dataverse
if PYTHONPATH=. pytest -q tests/test_parser_preview_gate.py tests/test_parser_aliases_service.py tests/test_parser_command_service.py -rs --durations=10; then echo OK; else echo NOK; fi
if PYTHONPATH=. pytest -q tests/test_api_integration.py::test_parser_preview_returns_plan_scope_risk_and_expected_events tests/test_api_integration.py::test_parser_execute_accepts_valid_preview_token tests/test_api_integration.py::test_parser_aliases_precedence_personal_over_workspace tests/test_api_integration.py::test_branch_promote_replays_with_idempotency_key tests/test_api_integration.py::test_table_contract_upsert_replays_with_idempotency_key tests/test_api_integration.py::test_star_core_mvp_endpoints_return_policy_runtime_and_pulse -rs --durations=10; then echo OK; else echo NOK; fi
if PYTHONPATH=. pytest -q tests/test_universe_read_model_consistency.py tests/test_universe_projection_errors.py -rs --durations=10; then echo OK; else echo NOK; fi
```

## 5. Rozhodnutí gate

Gate je splněný, pokud platí současně:

1. všechny 3 příkazy vrátí `OK`,
2. nevznikne neočekávané `5xx`,
3. žádný výrazný timing outlier neindikuje regresi oproti předchozímu release běhu.

## 6. Evidence šablona

Každý hardening běh doplní:

1. datum běhu,
2. hash commitu,
3. výstup tří příkazů (`OK/NOK`),
4. případné odchylky (`durations` outliers) + rozhodnutí.
