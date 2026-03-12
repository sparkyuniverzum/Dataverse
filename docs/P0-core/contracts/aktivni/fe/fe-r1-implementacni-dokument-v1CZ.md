# FE-R1 implementacni dokument v1

Stav: aktivni (vykonavaci priprava pred implementaci FE-R1)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

## 0. Vztah k ridicim dokumentum

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`

Tento dokument uz neni brainstorming.

Je to posledni priprava pred kodem.

## 1. Ucel bloku

Zavest prvni skutecny user-visible workspace po loginu:

1. s jednou dominantni first-view surface,
2. s `Star Core first` logikou,
3. s explicitnim prechodem `pred lock -> po lock`,
4. bez navratu stareho shell balastu.

## 2. Presny scope FE-R1

### 2.1 Stav A: `pred lock`

Implementovat:

1. centralni `Star Core` reprezentaci ve scene,
2. dominantni first-view governance shell,
3. copy:
   - `Nejdřív nastav zákony hvězdy`
4. tri stavove radky:
   - `Policy status`
   - `Law preset`
   - `Lock status`
5. primarni CTA:
   - `Otevřít Srdce hvězdy`
6. sekundarni vysvetlujici akci:
   - `Proč je to první krok`

### 2.2 Stav B: `po lock`

Implementovat:

1. stejnou dominantni centralni surface, ale v `ready` variante,
2. copy:
   - `Hvězda je uzamčena. Můžeš založit první planetu`
3. stav `LOCKED/POLICY_READY`,
4. primarni CTA:
   - `Založit první planetu`

### 2.3 Minimalni utility signal

Implementovat jen:

1. jemny `scope badge`,
2. jemny `mode badge`,
3. jemny `connectivity` signal.

Pravidlo:

1. nesmi vzniknout sidebar,
2. nesmi vzniknout utility panel,
3. nesmi vzniknout druhy center panel.

## 3. Mimo scope

V tomto bloku je zakazane implementovat:

1. grid,
2. command bar jako plny operation workflow,
3. parser preview,
4. branch rail,
5. onboarding mise,
6. capability UI,
7. recovery drawers,
8. plny `Star Core` dashboard,
9. runtime stream orchestrace z `FE-R2+`.

## 4. Aktivni soubory pro FE-R1

Ocekavane aktivni zmeny se maji soustredit jen sem:

1. `frontend/src/components/universe/UniverseWorkspace.jsx`
2. nove male helpery/modely v `frontend/src/components/universe/`
3. odpovidajici focused testy v `frontend/src/components/universe/`

Preferovane nove soubory:

1. `starCoreFirstViewModel.js`
2. `starCoreFirstViewModel.test.js`
3. `starCoreFirstViewSurface.jsx`
4. `starCoreFirstViewSurface.test.jsx`
5. pripadny maly `starCoreTruthAdapter.js`, pokud se ukaze potreba oddelit backend truth mapping

Pravidlo:

1. nerozsirovat zbytecne `UniverseWorkspace.jsx`,
2. stavovy model oddelit od renderu,
3. backend truth mapping oddelit od copy/render logiky.

## 5. Stavovy model

FE-R1 ma explicitne rozlisovat:

1. `loading`
2. `data_unavailable`
3. `star_core_unlocked`
4. `star_core_locked_ready`

Minimalni rozhodovaci pravidla:

1. kdyz nejsou data pripraveny, UI nesmi lhát; musi rict, ze data jeste nejsou k dispozici,
2. kdyz je `lock_status != locked`, prvni akce je vzdy `Otevřít Srdce hvězdy`,
3. kdyz je `lock_status == locked`, prvni akce je `Založit první planetu`,
4. v jednom stavu nesmi byt dve primarni CTA.

## 6. Pripraveny kod z archivu

Pro tento blok je pripraveny kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceStateContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceLayoutTokens.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se skutecne maji vratit:

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`
4. podle potreby `workspaceStateContract.js`

V tomto bloku se zatim nemaji vratit:

1. `useUniverseRuntimeSync.js`
2. `runtimeProjectionPatch.js`
3. `runtimeNormalizationSignal.js`
4. `commandBarContract.js`
5. `useMoonCrudController.js`

## 7. Vazba na backend pravdu

FE-R1 se povinne ridi:

1. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

Implementacni pravidla:

1. `Star Core` payload nesmi jit primo do renderu bez normalizeru,
2. `lock_status`, `law_preset`, `profile_mode`, `policy_version`, `locked_at` musi byt cteny pres `starContract.js`,
3. fyzikalni nebo vizualni odvozeni hvezdy/planet se nesmi delat ad-hoc fallbackem mimo helper,
4. pokud payload chybi nebo je rozbity, FE ukaze `data_unavailable`, ne optimistic guess.

## 8. Konkretni implementacni kroky

Poradi implementace:

1. vytvorit `starCoreFirstViewModel` jako cisty state resolver,
2. napojit ho na normalizovany `Star Core` truth input,
3. vytvorit jednu centralni render surface,
4. pridat subtilni utility signal mimo dominantni kartu,
5. pridat `pred lock` a `po lock` screenshot-ready stavy,
6. pridat focused testy,
7. az potom vyhodnotit screenshoty.

## 9. Focused gate

### 9.1 Focused testy

Minimalni pozadovane focused testy:

1. `starCoreFirstViewModel.test.js`
2. focused test pro normalizaci `Star Core` truth adapteru
3. focused render test centralni surface pro `pred lock`
4. focused render test centralni surface pro `po lock`

Pokud se vrati archived helper:

1. ma se vratit i odpovidajici focused test nebo jeho nova aktivni obdoba

### 9.2 Screenshot gate

Povinne screenshoty:

1. `pred lock`
2. `po lock`

Na obou musi byt bez vysvetlovani videt:

1. jedna dominantni surface,
2. stav workspace,
3. jedna primarni akce.

## 10. Completion pravidla

### 10.1 Technical completion

1. model + surface + truth mapping jsou oddelene,
2. aktivni runtime nepouziva zadny sidebar ani utility rail,
3. `pred lock` a `po lock` jsou deterministicke stavy.

### 10.2 User-visible completion

1. prvni pohled po loginu ma jasny governance-first smysl,
2. po locku je zretelne videt, ze se otevrel dalsi krok,
3. FE-R1 je skutecny produktovy posun, ne jen architektonicky refaktor.

### 10.3 Documentation completion

1. tento dokument zustava zdrojem pravdy pro implementacni scope,
2. navazny implementacni blok odkazuje na tento dokument a na `fe-r1-first-view-koncept-v1CZ.md`.

### 10.4 Gate completion

1. focused testy green,
2. screenshot `pred lock` a `po lock`,
3. explicitni hodnoceni, zda je first impression dost silny.

## 11. Co se nepocita jako uspech

1. druha karta se stejnym sdelenim,
2. fake data bez backend truth guardu,
3. visual polish bez jasneho CTA,
4. wow bez governance smyslu,
5. zavreni bloku bez screenshotu.

## 12. Evidence

Minimalni dukaz teto pripravy:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,340p' docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md
```

## 13. Co zustava otevrene

- [ ] Po schvaleni tohoto dokumentu prejit do kodu.
- [ ] Po implementaci dodat focused testy a screenshoty.
