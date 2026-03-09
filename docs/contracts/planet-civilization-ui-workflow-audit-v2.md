# Planet/Civilization UI Workflow Audit v2

Status: active
Date: 2026-03-09
Owner: FE/UX audit
Depends on:
- `docs/contracts/planet-civilization-ui-workflow-sprint-plan-v1.md`
- `docs/contracts/planet-civilization-moon-mineral-workflow-v1.md`

## 1. Scope

Re-audit kompletni UI flow:
1. Stage0 setup panel (preset/manual skladacka)
2. QuickGrid workflow rail + composers
3. Sidebar civilization orbit + inspector
4. End-to-end staging helper behavior

## 2. Summary

Aktualni stav je funkcni, ale UX flow je stale nelogicky v rozhodujicich bodech:
1. Existuje vice paralelnich cest pro stejnou operaci (composer vs direct buttons vs batch).
2. Nektere CTA maji skryty write side-effect (uzivatel nevi, ze uz uklada data).
3. Stage0 "skladacka" neni plne transparentni pro nepreddefinovane schema.
4. Error recovery je textova, ne krokova.

## 3. Findings (ordered by severity)

### F1 - Hidden write side-effect in workflow CTA

Severity: high

Evidence:
- `frontend/src/components/universe/QuickGridOverlay.jsx:1446`
- `frontend/src/components/universe/QuickGridOverlay.jsx:1472`

Issue:
- Tlacitko `Dalsi krok` nevede jen navigacne; v poslednim kroku rovnou vola `handleUpsertMineral()`.
- Uzivatel muze zpusobit write bez explicitniho "Ulozit" potvrzeni v mineral panelu.

Impact:
- neocekavane zapisy, slaba auditovatelnost akce, vyssi riziko chybneho remove_soft.

Required fix:
1. Rozdelit CTA na `Nastavit dalsi krok` a `Provest akci`.
2. Pri write kroku pouze fokusovat vstup + ukazat potvrzovaci tlacitko.

### F2 - Duplicate control paths for civilization operations

Severity: high

Evidence:
- `frontend/src/components/universe/QuickGridOverlay.jsx:1710`
- `frontend/src/components/universe/QuickGridOverlay.jsx:1755`
- `frontend/src/components/universe/QuickGridOverlay.jsx:1898`

Issue:
- Stejnou akci lze provest min. 3 zpusoby: composer apply, direct button, batch queue.
- Chybi jasne primarni flow, ktery je "official".

Impact:
- uzivatel netusi, kterou cestu pouzit; rozdilne UX feedbacky pro stejnou operaci.

Required fix:
1. Zvolit jeden primary path (composer).
2. Ostatni cesty degradovat na advanced sekci.
3. Sjednotit text feedbacku + event labels.

### F3 - Stage0 Lego mode still behaves as preset trigger, not explicit assembly output

Severity: high

Evidence:
- `frontend/src/components/universe/StageZeroSetupPanel.jsx:174`
- `frontend/src/components/universe/StageZeroSetupPanel.jsx:433`
- `frontend/src/components/universe/UniverseWorkspace.jsx:1558`

Issue:
- "Skladacka" vizualne vypada jako aktivni konstrukce, ale v lego mode commit jde pres preset apply (`seed_rows: true`).
- Uzivatel nevidi jasny map: ktere konkretni `field_key/field_type` budou finalne zapsany, pokud preset neni transparentni.

Impact:
- pocit "zmacknu a nevim co se stane"; tezsi duvera v builder.

Required fix:
1. Pred commitem zobrazit final contract payload diff.
2. U lego mode vypsat final field mapping zvoleneho presetu.
3. Jasne oddelit: `preset commit` vs `manual contract commit`.

### F4 - Contract violation is surfaced as raw error, not guided recovery

Severity: high

Evidence:
- `frontend/src/components/universe/StageZeroSetupPanel.jsx:508`
- `frontend/src/components/universe/WorkspaceSidebar.jsx:548`

Issue:
- Pri chybe typu `required field ... is missing` se zobrazi jen text.
- Uzivatel nedostane "klikni a oprav" flow (doplnit pole, default value, rerun validation).

Impact:
- rychla cesta do slepe ulicky; opakovani pokusu metodou pokus-omyl.

Required fix:
1. Recovery card: missing fields list + navrh defaultu.
2. Action buttons: `Doplnit automaticky`, `Otevrit schema composer`, `Znovu validovat`.

### F5 - Mineral remove_soft can be triggered by empty value without explicit confirmation

Severity: medium

Evidence:
- `frontend/src/components/universe/QuickGridOverlay.jsx:2057`
- `frontend/src/components/universe/QuickGridOverlay.jsx:2083`

Issue:
- Placeholder rika, ze prazdna hodnota = remove_soft.
- To je efektivni, ale nebezpecne pro bezne editace.

Impact:
- nechcene odstraneni nerostu.

Required fix:
1. Defaultne nepovolit remove_soft prazdnou hodnotou bez modal potvrzeni.
2. Zachovat explicitni tlacitko `Odebrat nerost` jako primarni delete path.

### F6 - Sidebar inspector and Grid inspector are not workflow-coupled enough

Severity: medium

Evidence:
- `frontend/src/components/universe/WorkspaceSidebar.jsx:472`
- `frontend/src/components/universe/QuickGridOverlay.jsx:2338`

Issue:
- Sidebar i Grid zobrazují inspector data, ale nenutne stejnou hloubku detailu a stejny kontext chyby.

Impact:
- uzivatel prepina mezi 2 panely a dostava ruzne info hustoty.

Required fix:
1. Spolecny inspector data model (state, violations, impacted minerals, repair actions).
2. "Open in Grid" / "Open in Sidebar" deep-link mezi inspektory.

### F7 - E2E helper validates mechanics, not user intent checkpoints

Severity: medium

Evidence:
- `frontend/e2e/staging/workspace-flow.helpers.mjs:123`
- `frontend/e2e/staging/workspace-flow.helpers.mjs:148`

Issue:
- Test potvrzuje viditelnost/kliknuti, ale nevaliduje operator-intent milestone (`schema understood`, `contract valid`, `civilization visible + selectable + writable`).

Impact:
- green test nemusi znamenat dobry UX flow.

Required fix:
1. Doplnit e2e assertions na semanticke milniky (napr. contract diagnostics = 0 missing).
2. Kontrolovat i negativni scenare (invalid transition, blocked write, recover).

## 4. Additional gaps discovered in this re-audit

1. Chybi globalni "workflow mode" switch (`Basic` vs `Advanced`) v QuickGrid.
2. Chybi sticky progress breadcrumb mezi Stage0 panelem a Gridem (uzivatel nevidi kontinuitu mise).
3. Chybi inline vysvetleni zdroje dat pro mineral key suggestions (`contract` vs `existing facts`).
4. Chybi explicitni completion badge pro "planet + civilization + mineral converged".

## 5. Recommended sprint mapping

1. UI-WF-1:
- F1, F2, F3, F4
2. UI-WF-2:
- F5 + mineral type workflow gaps
3. UI-WF-3:
- F6 + lifecycle explainability
4. UI-WF-4:
- F7 + convergence badge + release gates

## 6. Closure criteria for this audit

Audit v2 lze zavrit, az budou splneny body:
1. Zadna hidden write akce v navigacnim CTA.
2. Jedna kanonicka operational cesta pro civilization i mineral writes.
3. Contract violation ma guided recovery, ne jen text.
4. Staging e2e pokryva i semanticke milniky a negativni recover scenare.
