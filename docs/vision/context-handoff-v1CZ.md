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

1. FE navrat na zacatek `Bloku 3`.
2. Samostatny pozdejsi produktovy bod `logout / navrat do selectoru galaxii`.

### 2.3 Co je blocker

1. Zadny canonical BE blocker pro `Blok 3` uz nezustava.
2. Aktivni FE dokumentace byla vracena na zacatek `Bloku 3`; vsechny navazne FE dokumenty za timto bodem jsou vyradene a nejsou source of truth.
3. Dalsi prace se ma ridit pouze aktivnim `Blokem 3`, ne pozdejsimi odbockami.

### 2.4 Co je aktivni pravda

FE:

1. `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-return-packet-v1CZ.md`

BE:

1. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
3. `docs/P0-core/contracts/splneno/be/be-star-core-interior-implementacni-dokument-v1CZ.md`

## 3. Co ignorovat bez explicitni potreby

1. `docs/P0-core/contracts/splneno/` jako defaultni zdroj pravdy.
2. FE reset archivni davky, pokud neni potreba historicky dukaz.
3. Stare `Slice 1` dokumenty v historii.

## 4. Dalsi spravny krok

1. Otevrit FE praci znovu na zacatku `Bloku 3`.
2. Cist a upravovat jen aktivni dokument `fe-blok-3-implementacni-dokument-v1CZ.md`.
3. Pozdejsi FE dokumenty za zacatkem `Bloku 3` brat jen jako vyrazenou historii, ne jako aktivni smer.
