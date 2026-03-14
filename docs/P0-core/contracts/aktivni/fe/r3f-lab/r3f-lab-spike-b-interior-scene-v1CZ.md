# R3F Lab Spike B interior scene v1

Stav: aktivni
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Scope

Tento spike pokryva jen:

1. `frontend/src/lab/r3f/scenes/StarCoreInteriorCoreLabScene.jsx`
2. `frontend/src/lab/r3f/adapters/starCoreInteriorLabAdapter.js`

Implementovat:

1. prvni lab scenu `star_core_interior_core`,
2. adapter `semantic preset -> render config`,
3. vazbu na `LabCanvas`,
4. screenshot-ready stavy `debug` a `cinematic`.

## 2. Mimo scope

1. exterior scena,
2. produktovy redesign interieru,
3. backend truth napojeni,
4. externi GUI knihovna.

## 3. Pripraveny kod z archivu

Aktivni reuse reference:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

V tomto spike se smi vratit:

1. pattern oddelene kamerove logiky inspirovany `frontend/src/_inspiration_reset_20260312/components/universe/CameraPilot.jsx`

V tomto spike se nema vracet:

1. historicke interior UI surface,
2. stare panelove overlaye,
3. archivni `UniverseCanvas.jsx`

## 4. Focused gate

1. focused render test `lab_ready` se scenou `star_core_interior_core`
2. focused test pro invalid preset fallback
3. screenshot `debug`
4. screenshot `cinematic`

## 5. Review poznamka

1. review se ma soustredit na preset boundary a adapter disciplinu, ne na product polish interieru.
