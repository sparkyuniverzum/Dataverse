# FE Blok 2 implementacni dokument v1

Stav: aktivni (posledni priprava pred kodem Bloku 2)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

## 1. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to posledni priprava pred kodem `Bloku 2`.

## 2. Ucel bloku

Dodelat `Spatial Star Core exterior` jako prvni skutecne produktovy exterior kolem hvezdy uvnitr uz funkcniho `Galaxy Space Workspace`.

Blok ma dorucit:

1. hvezdu jako nejsilnejsi objekt prostoru,
2. governance prstenec a exterior signaly bez tezke pomocne karty,
3. diegeticke labely a orbitalni vrstvy, ktere jsou citelne v prostoru,
4. citelny rozdil `LOCKED / UNLOCKED / STABILIZING`,
5. zachovani volneho pocitu galaxie bez navratu ke star-lock rezimu.

## 3. Presny scope Bloku 2

### 3.1 Stav A: `star_core_exterior_idle`

Implementovat:

1. silnejsi vizual hvezdy jako governance anchor,
2. exterior governance prstenec kolem hvezdy,
3. diegeticke exterior labely ctene v prostoru,
4. svetelnou a tonalni vrstvu odpovidajici `policy` a `physics` payloadu.

### 3.2 Stav B: `star_core_exterior_selected`

Implementovat:

1. zvyrazneni exterioru po `selection focus`,
2. exterior affordance pro dalsi `approach`,
3. jemny HUD signal o vybranem exterioru bez navratu k informacni karte,
4. radar a scena musi drzet stejny focus.

### 3.3 Stav C: `star_core_exterior_approach`

Implementovat:

1. presnejsi `approach` k exterioru hvezdy,
2. citelny prostorovy rozdil mezi `free space` a `governance orbit`,
3. pripraveny prah pro pozdejsi vstup do jadra, ale bez jeho otevreni v tomto bloku,
4. zachovani orientace v prostoru galaxie.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. vstup do jadra `Star Core`,
2. `Constitution Select`,
3. `Policy Lock`,
4. builder system,
5. `grid`,
6. plny `command bar`,
7. onboarding cinematic nebo replay.

## 5. Aktivni soubory pro Blok 2

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. `frontend/src/components/universe/UniverseCanvas.jsx`
3. `frontend/src/components/universe/GalaxySelectionHud.jsx`
4. nove male helper/model moduly pro `Star Core exterior`
5. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `starCoreExteriorStateModel.js`
2. `starCoreExteriorStateModel.test.js`
3. `starCoreExteriorVisualModel.js`
4. `starCoreExteriorVisualModel.test.js`
5. `starCoreExteriorLabels.js`
6. `starCoreExteriorLabels.test.js`

Pravidlo:

1. nerozsirovat `UniverseWorkspace.jsx` o spatialni logiku, ktera patri do helperu,
2. exterior state a vizualni projekce musi byt oddelene od render vetve,
3. diegeticke labely musi mit samostatny helper pro cteni a orientaci ke kameře.

## 6. Stavovy model

Blok 2 ma explicitne rozlisovat:

1. `star_core_exterior_idle`
2. `star_core_exterior_selected`
3. `star_core_exterior_approach`

Minimalni rozhodovaci pravidla:

1. `space_idle` z Bloku 1 zustava nadrazeny prostorovy stav,
2. `single click` na hvezdu prepina exterior focus do `star_core_exterior_selected`,
3. `double click` na vybrany exterior prepina do `star_core_exterior_approach`,
4. `Esc` vraci `approach -> selected -> free space`,
5. Blok 2 nesmi sam otevrit `interaction focus` vnitrku hvezdy.

## 7. Vazba na backend pravdu

Pro Blok 2 je povinna tato pravda:

1. `GET /galaxies/{galaxy_id}/star-core/policy`
2. `GET /galaxies/{galaxy_id}/star-core/physics/profile`
3. `GET /galaxies/{galaxy_id}/star-core/runtime`
4. `GET /galaxies/{galaxy_id}/star-core/pulse`
5. `GET /galaxies/{galaxy_id}/star-core/domain-metrics`

Implementacni pravidla:

1. `lock_status` musi ridit exterior `LOCKED / UNLOCKED`,
2. `law_preset` a `profile_mode` musi menit tonalitu exterioru a governance prstence,
3. `coefficients` a `profile_key` smi ovlivnit jen odvozene vizualni chovani, ne vymyslenou finalni fyziku,
4. `pulse` data smi ovlivnit rytmus a impulsy, ale nesmi rozbit citelnost exterioru,
5. kdyz chybi payload, FE musi prejit do `stabilizing/unavailable` exterior fallbacku a nesmi optimisticly kreslit `LOCKED`.

## 8. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se skutecne maji vratit:

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`
4. podle potreby spatialni cast `UniverseCanvas.jsx`
5. podle potreby `previewAccessibility.js`

V tomto bloku se zatim nemaji vratit:

1. `StageZeroSetupPanel.jsx`
2. `visualBuilderStateMachine.js`
3. `QuickGridOverlay.jsx`
4. `ParserComposerModal.jsx`
5. `useCommandBarController.js`

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `starCoreExteriorStateModel` pro exterior `idle/selected/approach`,
2. vytvorit `starCoreExteriorVisualModel` pro mapovani `policy/physics/pulse` payloadu do exterior vizualu,
3. upravit spatial render hvezdy a governance prstence v `UniverseCanvas.jsx`,
4. oddelit diegeticke exterior labely do helperu s citelnosti ke kameře,
5. propsat exterior signal do `GalaxySelectionHud.jsx` bez tezkeho panelu,
6. doplnit `stabilizing/unavailable` fallback bez lhani o `LOCKED`,
7. pridat screenshot-ready stavy,
8. pridat focused testy.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `starCoreExteriorStateModel.test.js`
2. `starCoreExteriorVisualModel.test.js`
3. `starCoreExteriorLabels.test.js`
4. focused render test `star_core_exterior_idle`
5. focused render test `star_core_exterior_selected`
6. focused render test `star_core_exterior_approach`
7. focused test pro `stabilizing/unavailable` fallback

### 10.2 Screenshot gate

Povinne screenshoty:

1. `star_core_exterior_idle`
2. `star_core_exterior_selected`
3. `star_core_exterior_approach`
4. pokud je dostupny `UNLOCKED` payload, i screenshot `unlocked exterior`

### 10.3 Prisnejsi nez MVP

Blok se nesmi uzavrit, pokud:

1. hvezda pusobi stale jako hezky objekt bez governance vyznamu,
2. `LOCKED` a `UNLOCKED` se lisi jen textem,
3. diegeticke labely se zrcadli, lomi nebo jsou necitelne,
4. exterior rozbije pocit volne galaxie a znovu zamkne kameru,
5. vysledek potrebuje vysvetlujici kartu, aby daval smysl.

## 11. Co se nepocita jako completion

1. vetsi glow bez zmeny governance vyznamu,
2. prepsane copy bez prostoroveho rozdilu,
3. dalsi HUD box misto skutecneho exterioru,
4. `LOCKED` stav bez BE truth vazby,
5. screenshot jednoho hezkeho uhlu bez selection a approach logiky.

## 12. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/starContract.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js
```

## 13. Co zustava otevrene

- [ ] Otevrit implementaci `Bloku 2` v runtime.
- [ ] Po dokonceni `Bloku 2` rozhodnout, jestli je exterior uz dostatecne pripraveny pro `Blok 3: Star Core interior + Constitution Select + Policy Lock`.
