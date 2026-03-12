# UX IA a navigacni architektura v1

Stav: aktivní (release-grade baseline UX architektury)
Datum: 2026-03-11 (zalozeni), 2026-03-12 (zpřísneni gate)
Vlastník: Produktové UX + FE architektura

## 0. Update 2026-03-12

1. Baseline quality gate byl povysen na hard release gate.
2. Doplneny byly explicitni stop podminky (hard-stop) pri poruseni UX principu.
3. Doplnena byla dukazni sada (technical, user-visible, documentation, gate completion).

## 1. Ucel

Definovat informacni architekturu a navigacni model Dataverse tak, aby:

1. produkt pusobil jako operating center,
2. hlavni pracovni zona zustala primarni,
3. filmova 3D vrstva zlepsovala orientaci a duveru, ne latenci operatora.

## 2. Kanonicky architektonicky princip

Dataverse UX je rozdeleno do tri vrstev:

1. `Scene Layer` (3D vesmir): prostorova ontologie, kontext, branch atmosfera, viditelnost dopadu.
2. `HUD Layer` (sklenene overlaye): kompaktni stav, rezim, alerty, command prompt.
3. `Operation Layer` (grid/command): primarni autoring a exekuce mutaci.

Pravidlo:
Pokud je konflikt scena vs operace, vyhrava operace.

## 3. Informacni architektura

## 3.1 Top-level prostory

1. `Nexus` (vyber Galaxie + vstupni shell)
2. `Galaxy Workspace` (hlavni operacni centrum)
3. `Star Core` (governance/control plane)
4. `Planet Focus` (planet-level data a capability)
5. `Timeline/Branch` kontext (scope overlay, ne samostatna aplikace)

## 3.2 Vlastnictvi entit v IA

1. Galaxy vlastni workspace a branch scope.
2. Star/Star Core vlastni governance a runtime health.
3. Planet vlastni table/contract kontejner.
4. Moon je capability nad planet/table contract.
5. Civilization je kanonicka row runtime entita.
6. Mineral je typovana hodnota v civilization row.
7. Bond je relace mezi civilizations.

## 4. Navigacni model

## 4.1 Globalni navigace (vzdy dostupna)

1. Galaxy switcher.
2. Badge rozsahu (`MAIN` nebo `BRANCH:<name>`).
3. Mode badge (`NORMAL`, `PROMOTE`, `RECOVERY`, `GOVERNANCE`).
4. Kriticky system status (Star Core pulse a warningy).

## 4.2 Workspace navigace

1. Scene-driven vyber:
   - vyber Star/Planet/Civilization/Bond v 3D.
2. Operation-driven exekuce:
   - create/mutate/extinguish a mineral editace v grid/command vrstve.
3. Kontextove drawers:
   - pravy kontextovy drawer pro promote/recovery/governance review.

## 4.3 Star Core navigace

1. Vstup pres explicitni akci (`Otevřít Srdce hvězdy`).
2. Dive transition povoleny, ale preskocitelny.
3. Exit vzdy vraci uzivatele do predchoziho workspace kontextu a vyberu.

## 5. Prechody rezimu

## 5.1 Povoleny workspace mode

1. `NORMAL` - bezne datove operace.
2. `PROMOTE_REVIEW` - branch review a promote.
3. `RECOVERY_REVIEW` - repair/conflict/retry workflow.
4. `GOVERNANCE` - Star Core a policy akce.

## 5.2 Pravidla prechodu

1. Prepnuti modu musi aktualizovat badge + HUD do 200 ms.
2. Cinematic shift ma vysvetlovat, ne zdobit.
3. Budget animace prechodu: 150-400 ms (krome volitelnych onboarding sekvenci).
4. Kazdy mode ma explicitni exit akci a navratovy bod.

## 6. Priorita hlavni pracovni zony

1. Grid/command operacni oblast je vzdy viditelna v operacnich flow.
2. 3D scena nikdy nesmi schovat kriticke commit/repair ovladani.
3. Sidebar/drawer muze davat kontext, ale nesmi se stat primarnim editorem pro row CRUD.

## 7. Hranice cinematic systemu

## 7.1 Kde je cinematic povinny

1. Prvni onboarding vstup (`Nexus -> Galaxy Workspace`).
2. Star ignition a prvni governance lock potvrzeni.
3. Volitelne Star Core dive transition.

## 7.2 Kde je cinematic omezeny

1. Opakovane CRUD cykly (create/edit mineral/mutate/extinguish).
2. Rychle iteracni workflow v gridu.
3. Recovery smycky vyzadujici rychle retry.

## 7.3 Pristupnost a kontrola

1. Nastaveni `Reduce Motion` vypina nepodstatne transition.
2. Akce `Skip Cinematic` dostupna u vsech dlouhych transition.
3. Keyboard parity pro vsechny kriticke akce.

## 8. Atmosfericka dimenze branch

1. Branch kontext muze jemne menit globalni tonalitu/osvetleni.
2. Atmosfera nesmi byt jediny branch indikator.
3. Explicitni textovy branch badge je povinny.
4. Stav `MAIN` a `BRANCH` musi byt odlisitelny i v grayscale accessibility modu.

## 9. IA quality gate (hard release gate)

1. First paint hlavni pracovni zony (`Operation Layer`) musi byt:
   - p75 <= 1.2 s,
   - p95 <= 1.8 s
   na cilovem prostredi.
2. Time-to-first-actionable-edit (`workspace ready -> prvni validni row edit`) musi byt:
   - p75 <= 3.0 s,
   - p95 <= 4.5 s.
3. Zadny kriticky journey krok nesmi vyzadovat skrytou/neobjevitelnou navigaci.
4. Kazdy context switch musi explicitne deklarovat, zda zachovava nebo resetuje vyber.
5. Zadna entita nesmi byt editovana pres spatny ontologicky surface:
   - zadne moon-as-row editace,
   - zadny star-core-as-row editor.
6. Keyboard parity je povinna pro vsechny kriticke akce v `Nexus`, `Workspace`, `Star Core`.
7. Poruseni kterehokoli bodu 1-6 = hard-stop, release blokovan.

## 9.1 Dukazni evidence (povinna)

1. `technical completion`:
   - targeted FE testy pro navigaci, scope badge a mode switch.
2. `user-visible completion`:
   - before/after screenshoty: `Nexus`, `Galaxy Workspace`, `Star Core`.
   - explicitni seznam viditelnych zmen v prvnich 30 s.
3. `documentation completion`:
   - update kontraktu + mapovani rizik/guardrails.
4. `gate completion`:
   - alespon 1 bundled smoke gate po uzavreni slice serie.

## 9.2 Co se nepocita jako dukaz

1. Jen passing unit testu bez user-visible rozdilu.
2. Jen interni refaktor bez meritelneho dopadu na orientaci a rychlost.
3. Jen „cinematic efekt“ bez zlepseni discoverability a operation flow.

## 10. Mimo scope

1. Finalni visual skin/tokens.
2. Detailni per-component props/state kontrakty.
3. Plne journey skripty a acceptance testy.
