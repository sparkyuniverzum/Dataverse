# R3F Lab Spike A core shell v1

Stav: aktivni
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Scope

Tento spike pokryva jen:

1. `frontend/src/App.jsx`
2. `frontend/src/main.jsx`
3. `frontend/src/lab/r3f/`

Implementovat:

1. dev guard,
2. `labConfigSchema`,
3. `labSceneRegistry`,
4. `labPresetStore`,
5. `labPersistence`,
6. `R3FLabEntry`,
7. `R3FLabShell`,
8. `LabCanvas`,
9. placeholder scene surface pro `star_core_interior_core`,
10. zakladni diagnosticky model shellu.

## 2. Mimo scope

1. konkretni interior scena,
2. exterior scena,
3. `Leva`,
4. sequencer,
5. asset hot-swap,
6. `starCoreInteriorLabAdapter`,
7. `StarCoreInteriorCoreLabScene`.

## 3. Pripraveny kod z archivu

Aktivni reuse reference:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

V tomto spike se smi vratit:

1. pattern maleho store z `frontend/src/_inspiration_reset_20260312/store/useUniverseStore.js`
2. lehke budget utility inspirovane `frontend/src/_inspiration_reset_20260312/components/universe/scene/performanceBudget.js`

V tomto spike se zatim nema vracet:

1. archivni `UniverseCanvas.jsx`
2. historicke panelove shelly

## 4. Focused gate

1. `labConfigSchema.test.js`
2. `labSceneRegistry.test.js`
3. `labPresetStore.test.js`
4. focused test pro dev guard resolver
5. focused render test `R3FLabShell.test.jsx`
6. focused render test `R3FLabEntry.test.jsx`
7. shell musi umet `lab_closed`, `lab_booting`, `lab_ready`, `lab_invalid_preset`

## 5. Review poznamka

1. review se ma delat samostatne nad core shell vrstvou bez scen, aby se rychle odchytly contract chyby.

## 6. Aktualni implementacni stav

Aktualni start realizuje:

1. dev-only vetveni v `main.jsx`,
2. shell, persistence a diagnostics baseline,
3. placeholder renderer surface svazanou se `star_core_interior_core`,
4. dev-only `forced warning` kontrolu pro reprodukovatelny diagnostics screenshot.

Aktualne jeste neotevira:

1. konkretni adapter `semantic preset -> render config`,
2. konkretni doménovou scenu `StarCoreInteriorCoreLabScene`.

Tyto dve casti navazuji do `Spike B`.
