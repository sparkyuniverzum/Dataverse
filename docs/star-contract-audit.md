# Star Contract Audit (BE -> FE)

Datum: 2026-03-05

## Cíl
Zpevnit prozatimni logiku Star vrstvy:
- FE normalizuje payloady z BE na bezpecny shape.
- Je explicitne popsano, ktera pole z BE realne FE pouziva.

## Baseline Freeze v1
- Baseline soubor: `docs/star-contract-baseline-v1.json`
- Generator: `scripts/export_star_contract_baseline.mjs`
- Gate command: `make star-contract-gate`
- Gate script: `scripts/star_contract_gate.sh`
- Tento soubor je "zmrazeny referencni stav". Kazda zmena kontraktu musi:
  - aktualizovat baseline JSON,
  - aktualizovat tento audit,
  - projit testy FE kontraktu.

## Pravidlo zmen
- Pokud se zmeni `be_fields` nebo `fe_used_fields`, nesmi to projit bez auditu.
- `missing_in_be` musi zustat prazdne (`[]`).
- `unused_from_be` je povolene jen s vedomou klasifikaci:
  - `USE_NOW` = FE aktivne pouziva (musi byt i ve `fe_used_fields`).
  - `RESERVED` = zatim nepouzito, ale drzeno pro nejblizsi UI/telemetry kroky.
  - `DROP_CANDIDATE` = kandidat na odstraneni z BE payloadu po potvrzeni.

## Zdroj kontraktu (BE)
- `StarCorePolicyPublic` (`app/schema_models/star_core.py`)
- `StarCoreRuntimePublic` (`app/schema_models/star_core.py`)
- `StarCoreDomainMetricPublic` (`app/schema_models/star_core.py`)
- `StarCorePulseEventPublic` (`app/schema_models/star_core.py`)

## FE normalizace
- `frontend/src/components/universe/starContract.js`
- Pouzito v: `frontend/src/components/universe/useUniverseRuntimeSync.js`
- FE test freeze: `frontend/src/components/universe/starContract.test.js`

## BE kontrola baseline
- BE schema test: `tests/test_star_contract_baseline.py`
- Test kontroluje, ze pole ve `StarCore*Public` modelech odpovidaji frozen baseline.
- Test je napojen i do `scripts/backend_quality_gate.sh` a CI workflow.

## Diff (co BE dava vs co FE pouziva)

### Policy
- FE pouziva:
  - `profile_key`
  - `law_preset`
  - `profile_mode`
  - `no_hard_delete`
  - `deletion_mode`
  - `occ_enforced`
  - `idempotency_supported`
  - `branch_scope_supported`
  - `lock_status`
  - `policy_version`
  - `locked_at`
  - `can_edit_core_laws`
- BE dava navic (aktualne nepouzito v FE):
  - zadne (policy cleanup krok 4)

### Runtime
- FE pouziva:
  - `as_of_event_seq`
  - `events_count`
  - `writes_per_minute`
- BE dava navic (nepouzito):
  - zadne (runtime cleanup krok 2)

### Domains
- FE pouziva:
  - `domain_name`
  - `events_count`
  - `status`
  - `activity_intensity`
- BE dava navic (nepouzito):
  - zadne (domains cleanup krok 3)

### Pulse event
- FE pouziva:
  - `event_seq`
  - `event_type`
  - `entity_id`
  - `visual_hint`
  - `intensity`
- BE dava navic (nepouzito):
  - zadne (pulse cleanup krok 5)

## Poznamka
Z pohledu kontraktu neni zadne FE pole mimo BE schema (`missing_in_be = []`).

## Klasifikace (strojove)
Strojovy report je ulozen v `docs/star-contract-baseline-v1.json` pod:
- `classification.by_section`
- `classification.report`

### DROP_CANDIDATE (aktualni navrh)
- zadne (list je prazdny po cleanup kroku 1)

### RESERVED (aktualni navrh)
- zadne
