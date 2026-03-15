# R3F Lab implementacni mapa v1

Stav: aktivni
Datum: 2026-03-14
Vlastnik: FE architektura + user-agent governance

## 1. Ucel

Tento dokument drzi kratkou mapu cele implementacni cesty `R3F Lab`.

Je zamerne kratky, aby se review a navazovani dalo delat po malych blocich bez zbytecneho tokenoveho odpadu.

## 2. Aktivni podklady

Hlavni ridici dokumenty:

1. `docs/P0-core/contracts/aktivni/fe/fe-r3f-lab-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-r3f-lab-implementacni-dokument-v1CZ.md`

Rozsekane implementacni podklady:

1. `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-a-core-shell-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-b-interior-scene-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-c-exterior-scene-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/r3f-lab/r3f-lab-spike-d-hardening-review-v1CZ.md`

## 3. Rozpad cesty

1. `Spike A`
   scope: `frontend/src/lab/r3f/` core shell, schema, registry, persistence, entry guard
2. `Spike B`
   scope: `frontend/src/lab/r3f/scenes/` + `frontend/src/lab/r3f/adapters/` pro `star_core_interior_core`
3. `Spike C`
   scope: `frontend/src/lab/r3f/scenes/` + `frontend/src/lab/r3f/adapters/` pro `star_core_exterior`
4. `Spike D`
   scope: hardening, diagnostics, review pruchody, screenshot/test evidence

## 4. Review pravidlo

1. review po implementaci se ma delat po jednotlivych spike dokumentech,
2. po dokonceni cele cesty stale plati jeste `1-2` samostatne review pruchody robustnosti,
3. rozsekani dokumentu review pravidlo nerusi, jen ho dela levnejsim a citelnejsim.
