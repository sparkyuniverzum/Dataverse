# Backend MVP pokračování v1

Stav: aktivní (oficiální plán pokračování BE)
Datum: 2026-03-11
Vlastník: Core BE architektura

## 1. Co se změnilo

- [x] 2026-03-11 Založen oficiální navazující plán BE po cleanup auditu.
- [x] 2026-03-11 Nastavena priorita P0-1: `asteroid naming cleanup`.
- [x] 2026-03-11 Přidán realizační checklist, DoD podmínky a sekce gate evidence.

## 2. Proč to vzniklo

Po porovnání backendu s `backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md` zůstaly konkrétní mezery:

1. interní terminologický dluh `asteroid*`,
2. nejednotné idempotency pokrytí mutačních endpointů,
3. parser fallback politika a branch lifecycle dočištění.

Nejvyšší priorita je terminologická čistota runtime kódu, aby ontologie byla konzistentní napříč BE vrstvami.

## 3. Prioritní pořadí implementace

1. `P0-1` Asteroid naming cleanup (nejvyšší priorita).
2. `P0-2` Idempotency hardening mutačních endpointů mimo atomic wrapper.
3. `P1-1` Parser fallback policy hardening (v2/v1 fallback governance).
4. `P1-2` Branch lifecycle closure (`close` semantics a explicitní surface).

## 4. P0-1 Asteroid naming cleanup (priorita 1)

## 4.1 Cíl

Odstranit interní `asteroid*` názvosloví z backend runtime kódu a nahradit ho kanonickou terminologií:

- `civilization` pro row entitu,
- `moon` pro capability kontext.

## 4.2 Rozsah

Primární scope:

1. `app/api/mappers/*`
2. `app/api/routers/universe.py`
3. `app/services/universe/*`
4. `app/services/task_executor/*`
5. `app/services/star_core_service.py`
6. další runtime moduly v `app/`, kde se `asteroid*` vyskytuje.

Sekundární scope:

1. související testy v `tests/`, pokud referencují přejmenované symboly,
2. interní log/telemetry klíče, pokud nesou `asteroid*` název.

## 4.3 Mimo scope

1. veřejné API změny (namespace zůstává dle kanonického kontraktu),
2. nový feature vývoj,
3. FE refaktor (mimo BE blok).

## 4.4 Realizační checklist

- [ ] `P0-1.1` Přemapovat mapper názvy a pomocné funkce z `asteroid*` na `civilization*`.
- [ ] `P0-1.2` Přemapovat lokální proměnné/collection názvy v `universe` projekci.
- [ ] `P0-1.3` Přemapovat `task_executor` result field naming (`selected/extinguished_*`) na civilization terminologii.
- [x] 2026-03-11 `P0-1.4` Přemapovat star-core interní mapování domén bez `asteroid*` identifikátorů.
- [ ] `P0-1.5` Upravit související testy/importy tak, aby nepadaly na přejmenování.
- [ ] `P0-1.6` Ověřit, že v `app/` nezůstaly runtime `asteroid*` tokeny (kromě explicitně povolených výjimek, pokud budou schváleny).

## 4.5 DoD podmínky (P0-1)

P0-1 je hotové pouze pokud platí vše:

1. V runtime BE kódu (`app/`) není aktivní `asteroid*` terminologie pro row entitu.
2. Žádná přejmenovací změna neporuší kanonické endpointy (`/civilizations*`, capability surface).
3. Integrace stále drží soft-delete/OCC/idempotency behavior beze změny semantics.
4. Cílené testy relevantní k přejmenovaným modulům projdou.
5. Evidence je zapsána v tomto dokumentu v části `Evidence gate`.

## 4.6 Evidence gate (P0-1)

Stav:

- [ ] Gate splněno

Povinné ověřovací příkazy:

```bash
cd /mnt/c/Projekty/Dataverse
rg -n "\\basteroid\\b|\\basteroids\\b|ASTEROID" app
PYTHONPATH=. pytest -q tests/test_task_executor_service_stage2.py -rs
PYTHONPATH=. pytest -q tests/test_universe_projection_errors.py -rs
PYTHONPATH=. pytest -q tests/test_api_integration.py -k "civilization or moons or star_core" -rs
```

Kritérium splnění:

1. `rg` výstup pro runtime `app/` je prázdný, nebo obsahuje pouze předem schválené výjimky.
2. Cílené testy neobsahují nové regrese po přejmenování.

Evidence (doplnit po implementaci):

- [ ] Command output vložen / odkazován.
- [ ] Datum a autor uzavření zapsán.

## 5. Navazující bloky (po P0-1)

## 5.1 P0-2 Idempotency hardening

- [ ] Sjednotit mutační endpointy na konzistentní scoped idempotency policy.
- [ ] Uzavřít gap u command endpointů mimo `run_scoped_*` wrapper.

## 5.2 P1-1 Parser fallback policy

- [ ] Zpřesnit fallback governance (`v2 -> v1`) a explicitní policy režimy.
- [ ] Zachovat auditovatelný log důvod fallbacku.

## 5.3 P1-2 Branch lifecycle closure

- [ ] Zafixovat explicitní closure surface/semantiku větve.
- [ ] Udržet deterministický promote/close behavior bez vedlejších branch leaků.

## 6. Pravidlo průběžné kontroly

Po každém bloku:

1. aktualizovat checklist (`[ ]` -> `[x]`),
2. doplnit command evidence,
3. nezavírat blok bez evidence gate.
