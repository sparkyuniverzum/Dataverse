# FE archiv cleanup batch 2 v1

Stav: splneno (provedeny cleanup batch 2)
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-14 Byly smazany archived builder harness surface, ktere audit oznacil jako `NOK` pro produktovy FE smer.
- [x] 2026-03-14 Byl smazan navazany mrtvy component test vazany na odstraneny harness panel.
- [x] 2026-03-14 Byl doplnen zapis, ze `cleanup batch 2` se nedotkl pripravenych builder helperu ani jejich dukaznich testu.

## 2. Proc se to zmenilo

Po `cleanup batch 1` zustaly v archivu dalsi surface, ktere uz nemely obhajitelnou roli:

1. `PlanetBuilderWizardHarnessPanel.jsx` byl v davce D explicitne oznacen jako `NOK pro produktovy FE smer`.
2. `PlanetBuilderSmokeScreen.jsx` byl jen browser-smoke wrapper nad timto harness panelem.
3. jejich dalsi ponechani by zbytecne motalo dohromady prepared builder logiku s produktove nevhodnou surface.

Proto dava smysl odstranit je ted, ale zachovat podkladove helpery a state-machine logiku pro pozdejsi reuse podle aktivni reuse mapy.

## 3. Definitivne odstranene soubory

Smazane archived product surface:

1. `frontend/src/_inspiration_reset_20260312/components/PlanetBuilderSmokeScreen.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/PlanetBuilderWizardHarnessPanel.jsx`

Smazany mrtvy archived test:

1. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderWizardPanel.component.test.jsx`

## 4. Co zustava zachovano

Zustava zachovano:

1. `planetBuilderWizardHarness.js` jako interni harness helper,
2. `planetBuilderWizardHarness.test.js` jako engineering dukaz,
3. `planetBuilderFlow.js`, `planetBuilderUiState.js`, `planetBuilderConsistencyGuard.js` a dalsi builder helpery z reuse mapy,
4. ostatni scene/governance archived surface, ktere jsou zatim `mix`, `OK` nebo `POUZIT OPATRNE`.

To je dulezite, protoze `cleanup batch 2` cisti jen produktove nevhodny harness obal, ne technicke stavebnice.

## 5. Vztah k auditum a reuse mape

`Cleanup batch 2` potvrzuje:

1. verdikt davky D pro `PlanetBuilderWizardHarnessPanel.jsx` byl preveden do definitivniho odstraneni archived surface,
2. `PlanetBuilderSmokeScreen.jsx` nema samostatnou archived hodnotu mimo odstranenou harness surface,
3. aktivni reuse mapa zustava platna pro builder helpery a testove dukazy, ktere nebyly touto davkou dotcene.

## 6. Evidence

Minimalni dukaz tohoto cleanup bloku:

```bash
cd /mnt/c/Projekty/Dataverse
git diff -- docs/P0-core/README.md docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-1-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-2-v1CZ.md frontend/src/_inspiration_reset_20260312/components/PlanetBuilderSmokeScreen.jsx frontend/src/_inspiration_reset_20260312/components/universe/PlanetBuilderWizardHarnessPanel.jsx frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderWizardPanel.component.test.jsx
git status --short docs/P0-core/README.md docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-1-v1CZ.md docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-2-v1CZ.md frontend/src/_inspiration_reset_20260312/components frontend/src/_inspiration_reset_20260312/components/universe
```

Vysledek:

- [x] 2026-03-14 Archived harness/smoke surface z `cleanup batch 2` byly odstraneny.
- [x] 2026-03-14 Builder helpery a jejich dukazni testy zustaly zachovany.

## 7. Co zustava otevrene

- [ ] Po dalsim FE bloku pouzit reuse mapu a zapisovat do implementacnich dokumentu sekci `Pripraveny kod z archivu`.
- [ ] Zbyvajici archived surface se smisenym verdiktem (`GalaxySelector3D`, `StarHeartDashboard`, `CameraPilot`, `LinkHoverTooltip`) nechat zatim jen jako auditovany referencni material, dokud nevznikne samostatne rozhodnuti.
