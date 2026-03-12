# FE-R1 priprava: audit archivu v1

Stav: aktivni (povinna priprava pred FE-R1 navrhem)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 1. Ucel

Pripravit povinnou poradu nad FE archivem tak, aby se novy first-view koncept nestavel:

1. naslepo,
2. z dojmu,
3. nebo mechanickym vracenim stareho kodu.

Tento dokument je priprava, ne implementace.

## 2. Zavazny pracovni kontrakt

Pred FE-R1 navrhem musi probehnout:

1. prohlidka archivu `frontend/src/_inspiration_reset_20260312/`,
2. zapis verdictu `OK / NOK / proc / co prevzit / co odstranit`,
3. davkove schvaleni,
4. teprve potom navrh noveho first-view konceptu,
5. teprve po schvalenem navrhu implementace.

## 3. Scope porady

Vychozi pravidlo:

1. projde se cely puvodni authenticated FE archiv,
2. nic nema predem status "zachovat",
3. vse je kandidat na `NOK`, dokud neni obhajeno jako `OK`.

Archivni scope:

1. `frontend/src/_inspiration_reset_20260312/components/`
2. `frontend/src/_inspiration_reset_20260312/screens/`
3. `frontend/src/_inspiration_reset_20260312/hooks/`
4. `frontend/src/_inspiration_reset_20260312/store/`

## 4. Zasada FE-R1

Jediny spravny start noveho workspace je:

1. `Star Core first`

Zdovodneni:

1. nejdriv se musi urcit, jak se objekty v prostoru budou chovat,
2. teprve potom je smysluplne zavatet objekty do prostoru,
3. governance-first je kanonicka prvni autoritativni akce.

Tato zasada se v porade nepovazuje za otevrenou.

## 5. Auditni sablona

U kazde auditovane polozky musi zaznít:

1. `Polozka`
2. `Status`
   - `OK`
   - `NOK`
3. `Proc`
4. `Co prevzit`
5. `Co odstranit`
6. `Dukaz`
   - screenshot,
   - test,
   - nebo jasny code reference reason.

## 6. Davky porady

Porada se povede po davkach, ne vse najednou.

### 6.1 Davka A: Entry a shell

Scope:

1. puvodni authenticated vstup,
2. `GalaxyGateScreen`,
3. `WorkspaceShell`,
4. prvni prechod po loginu.

Otazka:
Co z puvodniho vstupniho toku skutecne zlepsovalo first impression a co bylo balast?

Stav:

1. [x] 2026-03-12 Audit uzavren v dokumentu `docs/P0-core/contracts/splneno/fe-reset/fe-r1-audit-archivu-davka-a-v1CZ.md`.

### 6.2 Davka B: Universe layout a dominantni surface

Scope:

1. `UniverseWorkspace`,
2. `UniverseCanvas`,
3. hlavni panely,
4. first-view hierarchie.

Otazka:
Co pomahalo jedne autoritativni primarni akci a co rozbijelo hierarchii?

Stav:

1. [x] 2026-03-12 Audit uzavren v dokumentu `docs/P0-core/contracts/splneno/fe-reset/fe-r1-audit-archivu-davka-b-v1CZ.md`.

### 6.3 Davka C: Operation a utility vrstvy

Scope:

1. `QuickGridOverlay`,
2. `WorkspaceSidebar`,
3. command surfaces,
4. utility a support panely.

Otazka:
Co ma potencial pro budoucnost a co se ma definitivne odstranit?

Stav:

1. [x] 2026-03-12 Audit uzavren v dokumentu `docs/P0-core/contracts/splneno/fe-reset/fe-r1-audit-archivu-davka-c-v1CZ.md`.

### 6.4 Davka D: Pokrocile workflow a builder vrstvy

Scope:

1. stage-zero a builder flow,
2. governance/recovery/promote vrstvy,
3. pokrocile workflow scaffoldy.

Otazka:
Co je inspirace pro pozdejsi faze a co je slepy smer?

Stav:

1. [x] 2026-03-12 Audit uzavren v dokumentu `docs/P0-core/contracts/splneno/fe-reset/fe-r1-audit-archivu-davka-d-v1CZ.md`.

## 7. Hodnotici kriteria `OK`

Polozka muze dostat `OK` pouze pokud:

1. ma jasny user-visible prinos,
2. podporuje `Star Core first`,
3. neposkozuje first-view hierarchii,
4. nepridava paralelni konkurencni surface,
5. da se obhajit i po resetu noveho FE.

## 8. Hodnotici kriteria `NOK`

Polozka musi dostat `NOK`, pokud:

1. duplikuje jinou surface,
2. vytvari vizualni sum,
3. zhorsuje orientaci,
4. je legacy komplikace bez presvedcive hodnoty,
5. odporuje novemu minimalistickemu zacatku,
6. neni obhajitelna screenshotem ani realnym flow.

## 9. Dalsi krok po porade

Po ukonceni schvalene auditni davky vznikne:

1. cisty seznam `OK` inspiraci,
2. cisty seznam `NOK` kandidatu pro definitivni odstraneni,
3. technicky inventory `helpers / hooks / store / testy`,
4. teprve potom navrh noveho FE-R1 first-view konceptu.

Bez teto pripravy se FE-R1 navrh nesmi prezentovat jako schvaleny smer.

Stav:

1. [x] 2026-03-12 Technicky inventory uzavren v dokumentu `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`.
2. [x] 2026-03-12 `cleanup batch 1` uzavren v dokumentu `docs/P0-core/contracts/splneno/fe-reset/fe-archiv-cleanup-batch-1-v1CZ.md`.
3. [x] 2026-03-12 Prisny FE-R1 navrh zapsan v dokumentu `docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md`.

## 10. Dukazni sada pripravy

Minimalni dukaz teto pripravy:

1. archivni seznam auditnich davek,
2. zapsana sablona `OK / NOK`,
3. potvrzeni poradi `priprava -> navrh -> implementace`,
4. technicky inventory archivu s reuse mapou.

## 11. Povinna sekce v navazujicich implementacnich dokumentech

Kazdy FE implementacni dokument navazujici na tuto pripravu musi obsahovat:

1. sekci `Pripraveny kod z archivu`,
2. odkaz na `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`,
3. odkaz na `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`, pokud blok pracuje s runtime daty,
4. rozhodnuti, ktere archived helpery se v danem bloku opravdu pouziji a ktere zatim ne.
