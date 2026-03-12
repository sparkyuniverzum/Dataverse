# FE-R1 implementacni dokument v2

Stav: nahrazeno (historicky FE-R1 vykonavaci dokument pred prechodem na Galaxy Space Workspace)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

Nahrazeno aktivnimi dokumenty:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`

## 0. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
1. `docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to posledni priprava pred kodem spatial FE-R1.

## 1. Ucel bloku

Zavest prvni skutecny user-visible workspace po loginu:

1. s centralni hvezdou jako aktivnim operacnim jadrem,
2. s governance `UNLOCKED -> LOCKED` prstencem primo kolem hvezdy,
3. s povinnym `Constitution Select` pred lockem,
4. s diegetickym nebo lehkym holografickym HUD misto velke karty,
5. bez navratu stareho shell balastu.

## 2. Presny scope FE-R1

### 2.1 Stav A: `pred lock`

Implementovat:

1. centralni spatial `Star Core` objekt ve scene,
2. governance prstenec kolem rovniku hvezdy,
3. diegeticke texty:
   - `GOVERNANCE: UNLOCKED`
   - `PHYSICS_PROFILE: ...`
   - `PULSE: STABILIZING`
4. lehky command affordance:
   - `Potvrdit ustavu a uzamknout politiky`
5. kamera nebo framing, ktery potvrdi, ze hvezda je stred prostoru.

### 2.2 Stav B: `constitution select`

Implementovat:

1. vstup do jadra hvezdy nebo jeho ekvivalentni spatialni focus,
2. vyber 3-4 rezimu ustavy:
   - `Rust`
   - `Rovnovaha`
   - `Straz`
   - `Archiv`
3. vysvetleni rezimu pres vizualni dusledek a kratkou vetu,
4. bez klasickeho formulare nebo tabulkoveho panelu.

### 2.3 Stav C: `lock in progress`

Implementovat:

1. kratkou lock sekvenci nebo alespon jeji jasne pripraveny stav,
2. fyzicke „zaklapnuti“ governance prstence,
3. prechod barev:
   - varovna zluta/oranzova -> stabilni chladna modra,
4. zmenu signalizace `UNLOCKED -> LOCKED`.

### 2.4 Stav D: `po lock`

Implementovat:

1. stabilizovanou hvezdu v `policy_ready` variante,
2. diegeticke texty:
   - `GOVERNANCE: LOCKED`
   - `STATUS: POLICY_READY`
3. prvni orbitalni stopu nebo drahu pro dalsi krok,
4. jemny CTA signal:
   - `Zalozit prvni planetu`

## 3. Minimalni HUD

Implementovat jen:

1. jemny globalni status v rohu skla,
2. pripadne maly scope/sync signal,
3. kratky command affordance pri locku.

Pravidlo:

1. nesmi vzniknout velka centralni karta,
2. nesmi vzniknout sidebar,
3. nesmi vzniknout utility panel,
4. HUD nesmi vizualne prevalcovat stred hvezdy.

## 4. Mimo scope

V tomto bloku je zakazane implementovat:

1. grid jako plny pracovni mod,
2. parser preview,
3. branch rail,
4. onboarding mise,
5. capability UI,
6. recovery drawers,
7. plny `Star Core` dashboard,
8. runtime stream orchestrace z `FE-R2+`,
9. builder workflow kolem planety.

Full `Nexus / Galaxy Selector` cinematic zustava nadrazenou vision vrstvou a nemusi byt kompletne hotovy v tomhle FE-R1 bloku.

## 5. Aktivni soubory pro FE-R1

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. nove male scene/helper moduly v `frontend/src/components/universe/`
3. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `UniverseCanvas.jsx`
2. `starCoreSpatialStateModel.js`
3. `starCoreSpatialStateModel.test.js`
4. `starCoreGovernanceRing.jsx`
5. `starCoreGovernanceRing.test.jsx`
6. `starCoreIgnitionScene.jsx`
7. `starCoreTruthAdapter.js`
8. `starCoreConstitutionSelect.jsx`
9. podle potreby `starCoreHudOverlay.jsx`

Pravidlo:

1. nerozsirovat zbytecne `UniverseWorkspace.jsx`,
2. spatial state model oddelit od renderu,
3. backend truth mapping oddelit od scene a kamery,
4. scene logika nesmi byt zakopana v jednom monolitu.

## 6. Stavovy model

Spatial FE-R1 ma explicitne rozlisovat:

1. `loading`
2. `data_unavailable`
3. `star_core_unlocked`
4. `star_core_constitution_select`
5. `policy_lock_transition`
6. `star_core_locked_ready`

Minimalni rozhodovaci pravidla:

1. kdyz nejsou data pripraveny, scena nesmi lhat; muze zustat ve `stabilizing` nebo `unavailable` rezimu,
2. kdyz je `lock_status != locked`, governance prstenec musi cist `UNLOCKED`,
3. pred `policy_lock_transition` musi probehnout `Constitution Select`,
4. kdyz je `lock_status == locked`, governance prstenec musi cist `LOCKED` a `POLICY_READY`,
5. dalsi planetarni krok se nesmi objevit pred lockem,
6. v jednom stavu nesmi byt dve konkurencni primarni akce.

## 7. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se skutecne maji vratit:

1. `UniverseCanvas.jsx` nebo jeho spatial jadro,
2. `starContract.js`
3. `lawResolver.js`
4. `planetPhysicsParity.js`
5. podle potreby `cameraPilotMath.js`
6. podle potreby `previewAccessibility.js`

V tomto bloku se zatim nemaji vratit:

1. `WorkspaceSidebar.jsx`
2. `WorkspaceShell.jsx`
3. `useUniverseRuntimeSync.js`
4. `runtimeProjectionPatch.js`
5. `runtimeNormalizationSignal.js`
6. `commandBarContract.js`
7. `useMoonCrudController.js`

## 8. Vazba na backend pravdu

Spatial FE-R1 se povinne ridi:

1. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

Implementacni pravidla:

1. `Star Core` payload nesmi jit primo do scene bez normalizeru,
2. `lock_status`, `law_preset`, `profile_mode`, `policy_version`, `locked_at` a fyzikalni profil musi byt cteny pres `starContract.js`,
3. spatialni derivace hvezdy, governance prstence a orbitalniho dalsiho kroku se nesmi delat ad-hoc fallbackem mimo helper,
4. pokud payload chybi nebo je rozbity, FE ukaze `stabilizing/unavailable`, ne optimistic `LOCKED`.

## 9. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `starCoreSpatialStateModel` jako cisty state resolver,
2. napojit ho na normalizovany `Star Core` truth input,
3. vratit spatialni `UniverseCanvas` jadro,
4. vytvorit governance prstenec s diegetickymi stavy,
5. pridat spatialni `Constitution Select`,
6. pridat lehky HUD signal pouze jako doplnkovou vrstvu,
7. pridat `pred lock` a `po lock` screenshot-ready stavy,
8. pridat focused testy,
9. az potom vyhodnotit screenshoty.

## 10. Focused gate

### 10.1 Focused testy

Minimalni pozadovane focused testy:

1. `starCoreSpatialStateModel.test.js`
2. focused test pro normalizaci `Star Core` truth adapteru
3. focused render test spatialni `pred lock` scény
4. focused render test `Constitution Select`
5. focused render test spatialni `po lock` scény
6. pokud se vrati `UniverseCanvas` jadro, tak i focused test jeho governance-first framingu

Pokud se vrati archived helper:

1. ma se vratit i odpovidajici focused test nebo jeho nova aktivni obdoba

### 10.2 Screenshot gate

Povinne screenshoty:

1. `pred lock`
2. `po lock`

Na obou musi byt bez vysvetlovani videt:

1. hvezda jako centralni operacni jadro,
2. governance stav primo na nebo kolem hvezdy,
3. `Constitution Select` jako prostorovy krok,
4. prostorovy rozdil mezi `UNLOCKED` a `LOCKED`,
5. dalsi krok vznikajici z prostoru, ne z panelu.

## 11. Completion pravidla

### 11.1 Technical completion

1. model + scene + truth mapping jsou oddelene,
2. aktivni runtime nepouziva centralni textovou kartu jako hlavni FE-R1 surface,
3. `Constitution Select` je oddelen od samotneho locku,
4. `pred lock` a `po lock` jsou deterministicke spatialni stavy.

### 11.2 User-visible completion

1. prvni pohled po loginu ma governance-first smysl primo ve scene,
2. hvezda vizualne nese prvni akci,
3. uzivatel pred lockem rozumi volbe ustavy prostoru,
4. po locku je zretelne videt, ze se otevrel orbitalni dalsi krok,
5. FE-R1 je skutecny produktovy posun, ne jen textovy panel nad pozadim.

### 11.3 Documentation completion

1. tento dokument zustava zdrojem pravdy pro spatial implementacni scope,
2. navazny implementacni blok odkazuje na tento dokument a na `fe-r1-first-view-koncept-v1CZ.md`,
3. panel-first smer je timto dokumentem explicitne vyrazen.

### 11.4 Gate completion

1. focused testy green,
2. screenshot `pred lock` a `po lock`,
3. explicitni hodnoceni, zda hvezda opravdu nese prvni akci a wow moment,
4. explicitni hodnoceni, zda `Constitution Select` neni degradovan na panelovy formular.

## 12. Evidence

Minimalni dukaz teto pripravy:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,360p' docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md
```

## 13. Co zustava otevrene

- [ ] Po schvaleni tohoto dokumentu prejit do spatial implementace.
- [ ] Po implementaci dodat focused testy a screenshoty.
