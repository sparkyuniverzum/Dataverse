# Context handoff v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: Produkt + FE + BE

## 1. Ucel

Tento dokument drzi kratky operacni handoff mezi bloky.

Pouziti:

1. po vetsi zmene smeru,
2. po uzavreni vice bloku,
3. pri navratu po kompakci nebo po delsi pauze.

## 2. Aktualni stav

### 2.1 Co je hotovo

1. FE `Blok 1` je uzavren jako `Galaxy Space navigation baseline`.
2. FE `Blok 2` je uzavren jako `Spatial Star Core exterior`.
3. BE orchestration baseline pro FE `Blok 3` je dodana:
   - interior schema
   - constitution catalog
   - interior read model
   - `constitution/select`
   - navazani `policy/lock` na selected constitution truth

### 2.2 Co je otevrene

1. FE runtime navrat na `Blok 3` nad novym `interior` contractem.
2. Dalsi FE bloky `Blok 4` az `Blok 8`.
3. Samostatny pozdejsi produktovy bod `logout / navrat do selectoru galaxií`.

### 2.3 Co je blocker

1. Zadny canonical BE blocker pro `Blok 3` uz nezustava.
2. Dalsi prace na `Bloku 3` musi ale uz cist workflow truth z backendu, ne z lokalnich FE modelu.

### 2.4 Co je aktivni pravda

FE:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`

BE:

1. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-implementacni-dokument-v1CZ.md`

## 3. Co ignorovat bez explicitni potreby

1. `docs/P0-core/contracts/splneno/` jako defaultni zdroj pravdy.
2. FE reset archivni davky, pokud neni potreba historicky dukaz.
3. Stare `Slice 1` dokumenty v historii.

## 4. Dalsi spravny krok

1. Otevrit `packet` pro navrat FE na `Blok 3`.
2. Implementovat FE `Blok 3` uz pouze nad `GET /star-core/interior` a navazujicimi canonical endpointy.
