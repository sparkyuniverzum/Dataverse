# New Thread Context Packet v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: Produkt + FE + BE

## 1. Ucel

Tento dokument je vstupni packet pro nove vlakno.

Ma odpovedet bez dohledavani na:

1. kde projekt skutecne je,
2. co je aktivni pravda,
3. co je slepy smer,
4. co je dalsi presny blok.

## 2. Aktualni realita

### 2.1 Co je hotovo

1. FE `Blok 1` je uzavren jako `Galaxy Space navigation baseline`.
2. FE `Blok 2` je uzavren jako `Spatial Star Core exterior`.
3. BE orchestration baseline pro FE `Blok 3` je hotova:
   - interior schema
   - constitution catalog
   - `GET /star-core/interior`
   - `POST /star-core/interior/constitution/select`
   - canonical navazani `policy/lock` na selected constitution truth

### 2.2 Co se potvrdilo jako slepy smer

1. `Star Core interior` drzeny jako dalsi zoom uvnitr stejne `Galaxy Space` sceny.
2. `dvojklik -> approach -> druhy dvojklik -> entry` jako uzivatelsky model.
3. ladeni interieru dalsimi camera fixy bez architektonicke zmeny.

### 2.3 Co je ted aktivni pravda

1. Hlavni pracovni prostor je `Galaxy Space`.
2. `Star Core` je centralni governance anchor uvnitr `Galaxy Space`.
3. `Star Core interior` je samostatna pracovni obrazovka.
4. Stejny princip ma pozdeji platit i pro interier planety.
5. FE `Blok 3` se musi implementovat nad canonical BE `interior` contractem.

## 3. Source of truth

### 3.1 Cti jako prvni

1. `docs/P0-core/contracts/aktivni/core/decision-log-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/core/context-handoff-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-return-packet-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
7. `docs/P0-core/contracts/splneno/be/be-star-core-interior-implementacni-dokument-v1CZ.md`

### 3.2 Nechodit tam bez duvodu

1. `docs/P0-core/contracts/splneno/`
2. stare `Slice 1` dokumenty
3. archivni FE batch dokumenty, pokud neni potreba historicky dukaz

## 4. Presny stav Bloku 3

### 4.1 Co uz vime

1. produktova logika `Constitution Select -> Policy Lock -> first_orbit_ready` je spravna,
2. backend contract pro ni uz existuje,
3. problem neni v domenove logice, ale ve screen architekture.

### 4.2 Co je zakazane

1. pokracovat v interieru jako v dalsim stavu uvnitr `UniverseCanvas`,
2. vymyslet lokalni FE workflow truth mimo backend,
3. dalsi improvizace kamerou bez oddeleni `Galaxy Space` a interior screen,
4. vracet se k panelovym workaroundum.

### 4.3 Co je dalsi spravny blok

`implementacni dokument Blok 3a: StarCoreInteriorScreen shell + transition + return contract`

Ten blok ma dodat:

1. shell samostatne interior screen,
2. transition z `Galaxy Space` do interior screen,
3. navrat z interior screen zpet do `Galaxy Space`,
4. bez dalsiho rozsireni do builderu, gridu nebo onboarding replay.

## 5. Runtime scope pro dalsi kod

Pouze tento working set:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. novy `StarCoreInteriorScreen.jsx`
5. novy `starCoreInteriorScreenModel.js`
6. `frontend/src/components/universe/starCoreInteriorAdapter.js`
7. focused testy v `frontend/src/components/universe/`

## 6. Minimalni navazujici gate

Blok po navratu se nesmi uzavrit, pokud:

1. interior stale vypada jako "vic zoomu v tomtez prostoru",
2. operator nema jasny pocit, ze vstoupil do jine pracovni vrstvy,
3. `Galaxy Space` a interior screen se stale perou o pozornost,
4. FE znovu drzi workflow truth, kterou uz umi vratit backend.

## 7. Jednovetny handoff

Projekt je ve stavu:

`Galaxy Space` a `Star Core exterior` jsou hotove, BE `Bloku 3` je hotove, a dalsi spravny krok je postavit `Star Core interior` jako samostatnou vysokokvalitni obrazovku nad uz existujicim backend contractem.
