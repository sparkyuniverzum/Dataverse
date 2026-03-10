# Session Handoff - 2026-03-10 (Slice 9 Prep)

## Stav
- FE runtime hardening sprint `RSV2-1..RSV2-4` je dokumentacne i evidencne uzavren.
- UX rework seam extraction je uzavrena pro Slice 2 az Slice 8.
- Dalsi navazujici refaktor blok je Slice 9 `Promote Review Surface`.

## Co je uzavreno
- Slice 2 `Selection / Inspector Split`
- Slice 3 `Unified Draft Rail`
- Slice 4 `Parser Composer Elevation`
- Slice 5 `Grid / Canvas Truth Alignment`
- Slice 6 `Timeline Rewrite`
- Slice 7 `Branch Visibility Layer`
- Slice 8 `Compare and Time Travel Layer`

Primary source:
- `docs/contracts/ux-rework-blueprint-v1.md`

Related closure:
- `docs/contracts/planet-civilization-runtime-stability-sprint-v2.md`
- `docs/contracts/p2-test-stability-report-2026-03-10.md`

## Replacement protocol je povinny
Kazdy dalsi blok musi pri nahrazeni stareho artefaktu zaznamenat:
- `GREEN` = zustava, nebyl nahrazen
- `ORANGE` = prechodna koexistence, explicitni duvod
- `RED` = plne nahrazen, odstranit ve stejnem bloku

Hard rule:
- pokud je artefakt plne nahrazeny, nema uz unikni odpovednost a neni potreba kvuli kompatibilite, je automaticky `RED`

Primary source:
- `docs/contracts/ux-rework-blueprint-v1.md`, section `17. Replacement protocol`

## Kde navazat
Slice 9 musi oddelit promote review UX od generickych branch controls.

Ocekavany zamer:
1. nevest promote review pres stejne ovladaci misto jako bezne branch scope prepinani
2. oddelit inspect/history/compare stav od finalni reality transfer akce
3. zachovat kanonicky replacement ledger a nevracet logiku zpatky do `UniverseWorkspace.jsx`

## Pracovni workflow pro dalsi bloky
1. Nejdriv analyza dotcene casti systemu.
2. Pak explicitni vypis:
   - co se bude dit
   - proc
   - presny rozsah
3. Implementace po malych blocich.
4. Agent spousti maximalne pre-commit a uzke lokalni checky.
5. Uzivatel spousti testy a dela commit.
6. Pred vystupem musi byt zmeny ulozene v dokumentaci/kodu a musi byt pripraven:
   - `Povel pro tebe`
   - navrzeny nazev git zaznamu

## Doporuceny vstup do Slice 9 analyzy
1. projit branch promote flow v `UniverseWorkspace.jsx` a `WorkspaceSidebar.jsx`
2. dohledat vsechny aktualni promote affordance a stavove vazby
3. rozhodnout, ktere artefakty budou `GREEN`, `ORANGE`, `RED` jeste pred zasahem
