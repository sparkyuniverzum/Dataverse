# Planet/Civilization UI Workflow Sprint Plan v1

Status: active (UI-WF-1/2/3 completed, UI-WF-4 partial)
Date: 2026-03-09
Owner: FE Lead + UX Lead + BE Contract Owner
Depends on:
- `docs/contracts/planet-civilization-moon-mineral-workflow-v1.md`
- `docs/contracts/planet-civilization-logical-flow-dod-v1.md`
- `docs/contracts/planet-civilization-ux-intent-v1.md`
- `docs/contracts/civilization-mineral-contract-v2.md`

## 1. Goal

Dodat konzistentni, operator-grade workflow pro:
1. Planetu (kontrakt + vyber + archivace)
2. Civilizaci/mesic (create/update/lifecycle/archive)
3. Nerost (typed value, validation, remove_soft)
4. Prubezny audit trail (workflow log) napric panelem + gridem + sidebarem

## 1.1 Priority fixes (body 1-5, serazeno dle zavaznosti + rozsahu + pocitove hodnoty)

1. `P0` Zpruhlednit Stage0 skladacku: pred commitem ukazat final field map + payload diff.
2. `P0` Nahradit raw contract chyby guided recovery flow (missing fields + action tlacitka).
3. `P0` Sjednotit civilization operace na jednu kanonickou cestu (composer jako primary path).
4. `P1` Odstranit hidden write side-effect z CTA `Dalsi krok` (zadny implicitni save).
5. `P1` Zabezpecit remove_soft: prazdna hodnota nesmi mazat bez explicitniho potvrzeni.

Prioritizacni logika:
1. Nejdriv body s nejvetsim dopadem na duveru uzivatele a citelnost flow (`P0`).
2. Potom body s vysokym bezpecnostnim dopadem v denni praci (`P1`).
3. Nakonec optimalizace a hardening (`P2`, viz sprinty nize).

## 2. Sprint map

## 2.0 Execution snapshot (2026-03-10)

- [x] `UI-WF-1` foundation + flow unification: gate set passed
- [x] `UI-WF-2` mineral complete workflow: gate set passed
- [x] `UI-WF-3` civilization complete workflow: gate set passed
- [ ] `UI-WF-4` planet+moon integration + release hardening: remaining closure

Evidence:
1. `npm --prefix frontend run test:e2e:workspace-starlock` -> `1 passed`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow` -> `1 passed`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs` -> `1 passed`
4. `npm --prefix frontend run test:e2e:planet-moon-preview` -> `1 passed`
5. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.minerals.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/lib/archiveWorkflowGuard.test.js` -> `21 passed`

### Sprint UI-WF-1 (foundation + flow unification)

Goal:
- odstranit dualni/konkurencni flow a zavest jeden kanonicky pruchod UI.

Scope:
1. Stage0 skladacka vs rucni rezim: jasne oddelena volba a vysledny commit behavior.
2. Jedna hlavni CTA cesta z workflow rail do composeru (bez skrytych side-effect mutaci).
3. Contract violation recovery panel (nejen surova chybova hlaska).
4. Sidebar + Grid semanticky stejna terminologie (`civilization/mesic`, `mineral/nerost`).

DoD:
1. Uzivatel vi, zda je v rezimu `preset` nebo `manual schema` a co commit presne udela.
2. "Dalsi krok" nikdy neprovede write bez explicitniho potvrzeni.
3. Pri contract violation je videt: chybejici pole, navrh opravy, tlacitko "opravit".
4. Stage0 + QuickGrid texty jsou konzistentni (bez rozporu "zelenani" bez vysvetleni).

Gate:
- `npm --prefix frontend run test -- src/components/universe/StageZeroSetupPanel.* src/components/universe/QuickGridOverlay.*`
- `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`

### Sprint UI-WF-2 (mineral complete workflow)

Goal:
- dovest nerosty do plne explicitniho typed workflow.

Scope:
1. Mineral composer: explicitni `key -> type -> value -> preview -> apply` rail.
2. Typove guardy + inline parser diagnostika (vstup, parse vysledek, fallback).
3. Batch nerostu: deterministic preview diff + partial-failure replay instrukce.
4. Log sjednoceni: vsechny mineral write operace do centralniho workflow logu.

DoD:
1. Uzivatel vidi zdroj typu (`contract`, `existing fact`, `manual`).
2. Remove-soft ma samostatny potvrzovaci krok (bez nechteneho smazani prazdnou hodnotou).
3. Batch mineral apply vraci summary + seznam fail itemu s reason.
4. E2E test kryje scenar: 2 civilizace -> write nerostu -> archive jedne civilizace -> konzistence UI.

Gate:
- `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.minerals.test.jsx`
- `pytest -q tests/test_api_integration.py -k "civilization_mineral"`

### Sprint UI-WF-3 (civilization complete workflow)

Goal:
- dovest civilizace do stabilniho lifecycle workflow + inspector parity.

Scope:
1. Civilization composer: explicitni modes (`CREATE/UPDATE/LIFECYCLE/ARCHIVE`) s precheck.
2. Lifecycle transition matrix v UI (co je povoleno z aktualniho stavu).
3. Inspector parity: stejna data v `CIVILIZATION ORBIT`, grid inspector a event logu.
4. Batch civilization commit: preview + conflict handling + retry path.

DoD:
1. Zadna lifecycle akce neni "implicitni".
2. `ACTIVE/DRAFT/ARCHIVED` transitions jsou validovany pred odeslanim.
3. Archive/extinguish vysledek je konzistentni v sidebaru, gridu i 3D orbitech.
4. Error `LIFECYCLE_TRANSITION_BLOCKED` ma v UI navodny recover path.

Gate:
- `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.civilizations.test.jsx src/components/universe/civilizationLifecycle.test.js`
- `pytest -q tests/test_api_integration.py -k "lifecycle or civilization"`

### Sprint UI-WF-4 (planet + moon integration + release hardening)

Goal:
- zafixovat end-to-end planet/civilization/mineral/moon flow jako release gate.

Scope:
1. Planet composer + schema composer: merge-safe kontrakt + guard proti destruktivnim prepisum.
2. Moon impact data a guided repair v jedne operator workflow stope.
3. Cross-panel synchronization (sidebar metrics, grid rows, setup panel state).
4. Final E2E staging mise + dokumentace provoznich runbooku.

DoD:
1. Preset apply ani manual schema commit neshodi tabulku na contract violation bez navrhu opravy.
2. Moon impact + guided repair jsou dohledatelne ve workflow logu.
3. Planet select/create/extinguish je konzistentni v UI i API projection refresh.
4. Staging smoke je green a stabilni ve dvou po sobe jdoucich behach.

Gate:
- `npm --prefix frontend run test:e2e:workspace-starlock`
- `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
- `pytest -q tests/test_api_integration.py`

Open items for closure:
1. [ ] Complete release hardening pass with full BE integration gate (`pytest -q tests/test_api_integration.py`) in final release profile.
2. [ ] Finalize moon-impact + guided-repair traceability as one explicit workflow-log path in runtime UI.
3. [ ] Freeze operator runbook note for this UI block in release docs.

## 3. Execution order (prioritizovano dle nejvetsiho zasahu + nejvetsi pocitove hodnoty)

1. UI-WF-1 (`P0`) - flow unification + transparentni skladacka + guided recovery
2. UI-WF-3 (`P1`) - civilization lifecycle konzistence a inspector parity
3. UI-WF-2 (`P1`) - mineral safety a typed workflow
4. UI-WF-4 (`P2`) - integrace, synchronizace, release hardening

Rule:
- dalsi sprint se spousti az po green gate predchoziho sprintu.

## 4. Risk register

1. Preset aplikace muze produkovat rows nekompatibilni s aktualnim contractem.
2. Paralelni ovladani (sidebar + grid + stage0) muze rozbit mental model stavu.
3. Smichane aliasy (`moon/civilization`) mohou rozbiti testy i telemetry.
4. OCC konflikty v batchech mohou zanechat UI v "napul aplikovanem" stavu bez jasne recover akce.

## 5. Success metrics

1. `time_to_first_valid_civilization_write_p95 <= 90s`
2. `mineral_write_error_recovery_rate >= 80%`
3. `lifecycle_transition_prevented_invalid_count` viditelne v telemetry (ne 0)
4. `e2e_planet_civilization_mineral_pass_rate >= 95%` na staging nightly
