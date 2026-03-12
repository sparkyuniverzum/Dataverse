# FE builder system Galaxy Space Workspace v1

Stav: aktivni (zavazny navrh builder systemu pro hlavni pracovni prostor galaxie)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + BE truth governance

## 1. Co se zmenilo

- [x] 2026-03-12 Byl zaveden novy aktivni builder system pro `Galaxy Space Workspace`.
- [x] 2026-03-12 Builder byl oddelen od stareho `stage-zero` shell pristupu a znovu definovan jako pracovni system nad prostorem galaxie.
- [x] 2026-03-12 Byl urcen vztah builderu ke `command bar`, `grid` a canonical mutation surface.

## 2. Proc to vzniklo

Bez explicitni definice builderu hrozi dva stejne spatne extremy:

1. builder-first UI znovu preroste workspace a vrati stary panelovy balast,
2. nebo se FE zasekne u ciste sceny bez skutecne produktivni pracovni vrstvy.

Proto je od ted zavazne:

1. hlavni workspace je `Galaxy Space Workspace`,
2. builder je pracovni system uvnitr tohoto prostoru,
3. builder neni jedna karta, jeden sidebar ani jeden modal,
4. builder musi vzdy promítat BE pravdu a jit pres canonical API surface.

## 3. Ridici dokumenty

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/command-lexicon-cz-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/parser-alias-learning-and-event-preview-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

## 4. Zavazny princip builderu

Builder system ma tri vrstvy:

1. `Space layer`
   - volny pohyb galaxii,
   - vyber objektu,
   - approach k objektu,
   - diegeticka orientace.
2. `Command layer`
   - zamer,
   - parser `Plan preview`,
   - explainability,
   - rychle potvrzeni akce.
3. `Precision layer`
   - grid jako canonical editor,
   - presna editace planety, `civilization`, vazby a kontraktu,
   - auditovatelne potvrzeni reality.

Builder je uspesny jen tehdy, kdyz tyto tri vrstvy spolupracuji a navzajem si nelzou.

## 5. Co builder system neni

Builder system neni:

1. permanentni `stage-zero` setup shell,
2. pravy sidebar s dlouhym checklistem,
3. fullscreen modal, ktery zamkne workspace,
4. alternativni write runtime mimo canonical API,
5. "AI magic" command bez preview a bez scope vysvetleni.

## 6. Chovani operatora

Operator je v hlavnim prostoru galaxie a builder se mu otevira podle kontextu.

Pravidla:

1. `single click` vybere objekt,
2. `double click` priblizi / vstoupi do interakcni vrstvy objektu,
3. `Ctrl/Cmd+K` otevre `command bar`,
4. `Open grid` otevre presnou datovou vrstvu pro aktualni planetu nebo `civilization`,
5. `Esc` vraci o uroven vys.

Builder nesmi uzivatele vytahnout z prostoru zbytecne brzo.

## 7. Role `command bar`

`Command bar` je vstup pro:

1. rychly zamer bez klikani,
2. guided chips,
3. slash syntax,
4. `intent text`,
5. `Plan preview` pred commitem.

Povinna pravidla:

1. command bar vzdy nese `scope lock`,
2. command bar vzdy ukazuje parser plan pred mutaci,
3. command bar muze otevrit nebo doplnit grid flow,
4. command bar nesmi obchazet canonical mutation paths.

## 8. Role `grid`

`Grid` je canonical editor reality.

Plati:

1. scena je orientace a selection,
2. grid je rychly editor dat,
3. row a bond write flow musi jit dokoncit ciste pres grid,
4. grid musi byt synchronizovan s vybranou planetou a `civilization`,
5. grid se otevíra jen kdyz ma realny pracovni duvod.

`Grid` neni hlavni vstupni obrazovka galaxie.

## 9. Builder flow podle typu akce

### 9.1 Zalozeni planety

Minimalni flow:

1. operator vybere orbitu nebo planetarni slot v prostoru,
2. builder nabídne lehky archetyp/preset affordance,
3. command bar ukaze `Plan preview`,
4. canonical zapis jde pres `POST /planets`,
5. po vytvoreni se muze otevrit grid pro schema a prvni `civilization`.

### 9.2 Prace s `civilization`

Minimalni flow:

1. operator vybere planetu,
2. otevre grid nebo command CTA,
3. FE ukaze preview mutace,
4. canonical zapis jde pres `/civilizations*`,
5. scena zobrazi konvergenci bez rozchodu s gridem.

### 9.3 Vytvoreni vazby

Minimalni flow:

1. operator vybere zdroj a cil v prostoru nebo gridu,
2. command bar nebo grid vygeneruje preview,
3. validace/cykly/OCC se vysvetli pred commitem,
4. canonical zapis jde pres `/bonds*`.

### 9.4 Capability / mesic

Capability vrstva se aktivuje az nad stabilni planetou.

Plati:

1. capability se cte z `GET /planets/{planet_id}/capabilities`,
2. v prostoru se projevi jako mesic/modul,
3. builder ji nesmi plest s row runtime.

## 10. Stavovy model builderu

Builder system ma mit jednu stavovou pravdu bez ohledu na vstupni vrstvu.

Minimalni aktivni stavy:

1. `space_idle`
2. `object_selected`
3. `approach_active`
4. `command_draft`
5. `preview_ready`
6. `grid_open`
7. `commit_in_progress`
8. `converged`
9. `error_recoverable`

Pravidla:

1. `space`, `command bar` i `grid` musi vedet, v jakem stavu builder je,
2. preview a commit musi mit jednu auditovatelnou osu,
3. po commitu musi byt potvrzena konvergence `scene + grid + runtime`.

## 11. Vazba na backend pravdu

Builder system se povinne opira o:

1. `GET /universe/tables`
2. `GET /universe/snapshot`
3. `GET /contracts/{table_id}`
4. `GET /planets/{planet_id}/capabilities`
5. `POST /parser/plan`
6. `POST /parser/execute`
7. `POST /tasks/execute-batch`
8. `POST /planets`
9. `/civilizations*`
10. `/bonds*`

Pravidlo:

1. builder smi jen orchestravat canonical runtime pravdu,
2. nesmi si vytvaret vlastni paralelni stav reality,
3. pri chybe musi zustat posledni validni krok obnovitelny.

## 12. Pripraveny kod z archivu

Pouzitelne moduly:

1. `frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/useCommandBarController.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx`
4. `frontend/src/_inspiration_reset_20260312/components/universe/gridCanvasTruthContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/selectionContextContract.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderFlow.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderUiState.js`
8. `frontend/src/_inspiration_reset_20260312/components/universe/visualBuilderStateMachine.js`
9. `frontend/src/lib/builderParserCommand.js`

Verdikt pouziti:

1. vratit stavovou logiku a kontrakty,
2. nevracet puvodni shell a setup panely,
3. `QuickGridOverlay.jsx` brat jako archivni rozklad odpovednosti, ne jako UI ke copy/paste,
4. parser command helpery vratit jen pokud zustanou v souladu s `/civilizations*` a `moon = capability`.

## 13. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md
sed -n '1,240p' frontend/src/_inspiration_reset_20260312/components/universe/useCommandBarController.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/commandBarContract.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/QuickGridOverlay.jsx
sed -n '1,240p' frontend/src/_inspiration_reset_20260312/components/universe/gridCanvasTruthContract.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/planetBuilderFlow.js
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/visualBuilderStateMachine.js
sed -n '1,220p' frontend/src/lib/builderParserCommand.js
```

Vysledek:

- [x] 2026-03-12 Bylo potvrzeno, ze archiv uz obsahuje pouzitelne kontrakty pro `command bar`, `grid sync`, parser preview a builder state orchestration.
- [x] 2026-03-12 Bylo potvrzeno, ze puvodni builder-first UI neni treba vracet; vratit se ma jen stavova disciplina a preview/commit logika.

## 14. Co zustava otevrene

- [x] 2026-03-12 Zavazny vykonavaci dokument `Galaxy Space Workspace v1` byl zapsan.
- [ ] Rozhodnout prvni builder implementacni rez po navigacni baseline: `command bar`, nebo `grid open from planet context`.
- [ ] U dalsiho builder bloku explicitne vybrat, ktere archived helpery se vraci do aktivni runtime.
