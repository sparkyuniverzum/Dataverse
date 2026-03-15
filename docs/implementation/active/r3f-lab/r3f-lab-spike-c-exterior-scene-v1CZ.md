# R3F Lab Spike C exterior scene v1

Stav: aktivni
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Scope

Tento spike pokryva jen:

1. `frontend/src/lab/r3f/scenes/StarCoreExteriorLabScene.jsx`
2. `frontend/src/lab/r3f/adapters/starCoreExteriorLabAdapter.js`
3. rozsireni `labSceneRegistry` o `star_core_exterior`

Implementovat:

1. druhou lab scenu `star_core_exterior`,
2. navazny adapter,
3. rozsireni shellu o druhou registrovanou scenu.

## 2. Mimo scope

1. sequencer,
2. externi GUI knihovna,
3. zmena scope `Spike A` nebo `Spike B`.

## 3. Pripraveny kod z archivu

Aktivni reuse reference:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

V tomto spike se smi vratit:

1. jen male patterny nebo utility, ktere nejsou produktovou surface

V tomto spike se nema vracet:

1. archivni `UniverseCanvas.jsx` jako celek
2. stare dashboardy

## 4. Focused gate

1. focused render test `star_core_exterior`
2. screenshot `debug`
3. screenshot `cinematic`
4. registry test s vice scenami

## 5. Review poznamka

1. review se ma soustredit na to, jestli druha scena stale drzi maly scope a nerozbija core shell kontrakt.
