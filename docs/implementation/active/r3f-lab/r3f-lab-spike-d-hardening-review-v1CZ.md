# R3F Lab Spike D hardening review v1

Stav: aktivni
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Scope

Tento spike pokryva:

1. hardening preset workflow,
2. hardening diagnostickych warningu,
3. screenshot a focused test evidence,
4. zaverecne `1-2` review pruchody robustnosti.

## 2. Mimo scope

1. nova scena bez noveho rozhodnuti,
2. product redesign,
3. rozsirovani scope mimo `R3F Lab`.

## 3. Pripraveny kod z archivu

Aktivni reuse reference:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

V tomto spike se smi vratit:

1. lehke budget warning patterny inspirovane `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`

## 4. Focused gate

1. screenshot evidence pro vsechny podporovane scene a rezimy
2. focused testy pro hardening warningy
3. focused testy pro persistence edge cases
4. samostatny review pruchod 1
5. samostatny review pruchod 2, pokud po prvnim zustanou otevrena rizika

## 5. Review poznamka

1. tento spike je povinny i kdyz predchozi implementace "funguje",
2. cil je zvednout odolnost a snizit budoucI cenu dalsich iteraci.
