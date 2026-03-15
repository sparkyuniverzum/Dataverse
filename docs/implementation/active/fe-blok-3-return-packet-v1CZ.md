# FE Blok 3 return packet v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: FE architektura + Produkt + BE truth governance

## 1. Ucel

Tento packet drzi minimalni working set pro navrat FE na `Blok 3`.

Je to zamerne kratky dokument pro setreni kontextu.

## 2. Presny cil

Vratit FE runtime `Bloku 3` nad canonical backend pravdu pro interier hvezdy a postavit ho jako samostatnou `Star Core interior screen`.

## 3. Mimo scope

1. `Blok 4` planety a orbity jako plna pracovni vrstva,
2. `grid`,
3. obecny `command bar`,
4. onboarding replay,
5. logout / navrat do selectoru galaxii.

## 4. Source of truth

FE:

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

BE:

1. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
2. `docs/P0-core/contracts/splneno/be/be-star-core-interior-implementacni-dokument-v1CZ.md`

## 5. Runtime soubory

Pouze tento working set:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. novy samostatny screen komponent pro `Star Core interior`
5. `frontend/src/components/universe/starCoreTruthAdapter.js`
6. nove male `starCoreInterior*` helpery a focused testy

## 6. Backend zavislosti

FE musi pouzit:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

## 7. Gate pro navrat

1. FE nesmi znovu vymyslet lokalni workflow truth, pokud ji umi vratit backend.
2. `constitution_select`, `policy_lock_ready`, `policy_lock_transition`, `first_orbit_ready` se musi cist z `interior` contractu.
3. `Star Core interior` nesmi zustat jen dalsi zoom uvnitr stejneho `Galaxy Space` canvasu.
4. Screenshoty musi pokryt:
   - `star_core_interior_entry`
   - `constitution_select`
   - `policy_lock_ready`
   - `policy_lock_transition`
   - `first_orbit_ready`
5. Focused testy musi pokryt adapter, interior screen state a lock recoverability.

## 8. Otevrene riziko

1. Pokud FE narazi na chybejici pole nebo nejednoznacny `interior` payload, prace se zastavi a vrati zpet do BE contractu, neobejde se to lokalnim workaroundem.
2. Pokud interior screen znovu zacne vizualne kolidovat s `Galaxy Space`, je to signal spatne architektury, ne jen potreba dalsiho camera polish.
