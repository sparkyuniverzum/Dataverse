# UX FE komponentovy behavior kontrakt v1

Stav: aktivní (release-grade baseline FE chovani)
Datum: 2026-03-11 (zalozeni), 2026-03-12 (zpřísneni gate)
Vlastník: FE architektura + UX inženýrství

## 0. Update 2026-03-12

1. Komponentovy behavior gate byl povysen na hard release gate.
2. Doplneny byly explicitni latency a determinism budgety pro p75/p95.
3. Doplnena byla stop pravidla pro ontologii, mutation flow a recovery explainability.

## 1. Ucel

Definovat komponentovy behavior kontrakt tak, aby FE implementace byla:

1. vizualne spickova,
2. operacne rychla,
3. testovatelna a deterministicka.

## 2. Komponentova topologie

## 2.1 Scene layer komponenty

1. `UniverseCanvas`:
   - renderuje prostorovy model star/planet/civilization/bond,
   - podporuje vyber a context focus,
   - nikdy primo neprovadi kanonickou datovou mutaci.
2. `SpatialLabels`:
   - diegeticke stitky/metryky pobliz entit,
   - striktne read-only overlaye.

## 2.2 HUD layer komponenty

1. `GlobalStatusHUD`:
   - scope badge (`MAIN`/`BRANCH`),
   - mode badge,
   - core status a warning stav.
2. `CommandBar`:
   - primarni command prompt a quick akce,
   - keyboard-first parity.
3. `ContextDrawers`:
   - promote/recovery/governance kontextove workflow,
   - bez prevzeti role core row authoring.

## 2.3 Operation layer komponenty

1. `QuickGridOverlay`:
   - kanonicky row/mineral authoring surface,
   - commit/preview/repair exekucni controls.
2. `WorkspaceSidebar`:
   - scope souhrn a kontextovy insight,
   - nekanonicky editacni surface pro komplexni row mutace.
3. `InspectorPanels`:
   - detail vybrane entity a traceability.

## 3. Kanonicka behavior pravidla

1. Kanonicke row write cesty musi cilit na `/civilizations*`.
2. Moon interakce musi cilit na capability/contract surface, nikdy na row CRUD namespace.
3. Scene selection aktualizuje operation context, ne naopak pres side effect.
4. Kazda write akce musi surface-nout OCC/idempotency failure jako repairable event.
5. Extinguished entity zustavaji viditelne jako historical ghost stav, pokud to filter povoli.

## 4. State model podle tridy komponent

## 4.1 Sdilene stavy

1. `idle`
2. `loading`
3. `ready`
4. `warning`
5. `error`
6. `recovering`

## 4.2 Write operation stavy

1. `draft`
2. `previewed`
3. `committing`
4. `committed`
5. `blocked`
6. `repair_required`

Pravidlo:
Bez ticheho selhani. `blocked` a `repair_required` musi obsahovat duvod a akci.

## 5. Interaction kontrakty

## 5.1 Vyber a focus

1. Klik ve scene aktualizuje vybranou entitu a focus kontext.
2. Sidebar a grid selection zustavaji synchronizovane.
3. Ztrata focusu nikdy nesmi potichu zahodit neulozeny draft.

## 5.2 Mutation flow

1. Uzivatel iniciuje mutaci v operation layer.
2. Request payload obsahuje scope + OCC ocekavani tam, kde je vyzadovano.
3. Response aktualizuje workflow log a vizualni stav.
4. Scena reflektuje mutaci asynchronne, ale deterministicky.

## 5.3 Moon capability attach flow

1. Vstup do capability modu na planet scope.
2. Drag/drop moon modulu jen na validni capability slot target.
3. Invalid target drop vraci modul do inventare s explicitni odezvou.
4. Commit aplikuje contract effect a aktualizuje indikatory zavisleho row behavior.

## 5.4 Bond link flow

1. Vyber source civilization.
2. Vyber target civilization s live validity preview.
3. Commit nebo reject se strukturovanym duvodem.
4. Extinguish uchova historical relation trace.

## 6. Error a recovery behavior

1. OCC konflikt:
   - zobrazit current vs expected sekvenci,
   - nabidnout refresh + retry cestu.
2. Validation failure:
   - zobrazit problemovy mineral/pole a duvod pravidla,
   - nabidnout vedeny repair krok.
3. Neshoda rozsahu (scope mismatch):
   - explicitne zobrazit branch/main context mismatch.
4. Network/runtime failure:
   - zobrazit resilient retry moznosti s idempotency-safe navodem.

## 7. Telemetry kontrakt

Musime emitovat strukturovane eventy pro:

1. mode enter/exit,
2. zmenu vyberu,
3. mutation preview/commit/fail/recover,
4. OCC konflikt a jeho vyreseni,
5. capability attach/commit akce,
6. bond preview/create/extinguish akce.

Telemetry event musi obsahovat:

1. `galaxy_id`,
2. `branch_id` (nullable),
3. `entity_type`,
4. `entity_id`,
5. `action`,
6. `result`,
7. `latency_ms`.

## 8. Performance budget

1. selection feedback:
   - p75 <= 80 ms,
   - p95 <= 120 ms,
2. command feedback (ack):
   - p75 <= 180 ms,
   - p95 <= 300 ms,
3. drawer open/close:
   - p75 <= 220 ms,
   - p95 <= 320 ms,
4. standard micro-transition: 150-400 ms,
5. opakovane row editace nesmi triggerovat full scene re-layout.

## 9. Accessibility a kontrolni kontrakty

1. Vsechny kriticke akce jsou keyboard reachable.
2. Focus order je deterministicky v HUD i operation layer.
3. Reduced motion zachovava vsechny funkce.
4. Barva neni jediny nosic stavu.

## 10. Testovatelnost

1. Kazde core behavior ma stabilni test-id anchor.
2. Komponentove kontrakty se mapuji na focused unit/integration testy.
3. Kriticke journey se mapuji na narrow smoke scenare bez povinne dlouhe cinematic cesty.
4. Zadne behavior nesmi zaviset na nedeterministickem casovani animaci.

## 11. Zakazane implementacni zkratky

1. Paralelni skryte mutation cesty obchazejici kanonicke API.
2. 3D-only editacni flow bez grid fallback parity.
3. Tichy alias fallback na odstranene endpointy.
4. Docasne netypovane pohlcovani chyb v mutation/recovery flow.

## 12. Hard release gate (must pass all)

1. Ontologicka cistota:
   - `civilization` je jediny row edit surface po strance semantics i copy.
   - `moon` je capability-only surface.
2. Mutation determinismus:
   - zadna ticha ztrata draftu,
   - zadne „unknown error“ bez repair path.
3. Recovery explainability:
   - OCC/validation/scope konflikt vzdy obsahuje jasny dalsi krok.
4. Runtime UX konzistence:
   - mode/scope badges jsou stale viditelne a konzistentni s aktivnim kontextem.
5. Keyboard a reduce-motion parity:
   - kriticke akce jsou proveditelne bez mysi a bez cinematic zavislosti.
6. Poruseni kterehokoli bodu 1-5 = hard-stop, release blokovan.

## 12.1 Dukazni evidence (povinna)

1. `technical completion`:
   - focused testy pro `QuickGridOverlay`, `WorkspaceSidebar`, `CommandBar`, mode/scope indikatory.
2. `user-visible completion`:
   - before/after screenshoty hlavnich operation flow.
   - explicitni seznam, co se zlepsilo v discoverability a rychlosti.
3. `documentation completion`:
   - update kontraktu + navazne risk mapy.
4. `gate completion`:
   - 1 bundled smoke gate po uzavreni komponentove serie.

## 12.2 Co se nepocita jako completion

1. Jen passing unit testu bez behavior parity v realnem flow.
2. Jen internal refactor bez zmeny operator UX kvality.
3. Jen micro-animation polish bez impactu na commit/repair workflow.
