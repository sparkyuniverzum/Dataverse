# FE-R1 first-view koncept v2

Stav: nahrazeno (historicky FE-R1 navrh pred prechodem na Galaxy Space Workspace)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

Nahrazeno aktivnimi dokumenty:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`

## 0. Pre-implementation kontrakt

### 0.1 Zavazne podminky prevzate z ridicich dokumentu

Tento navrh je zavazne hodnocen proti temto podminkam:

1. `Star Core first` je jediny spravny start noveho workspace.
2. Dataverse musi stat na prostorove ontologii, ne na panelovem desktopu.
3. Hvezda je fyzicky i vyznamove centralni zdroj zakonu a governance.
4. Rozhrani ma byt diegeticke a holograficke; nepruhledne 2D panely maji byt minimalizovany.
5. FE musi promítat backend pravdu, ne ji nahrazovat textovym odhadem.
6. User-visible uspech se pocita jen tehdy, kdyz je zmena realne videt v prvnim dojmu a v prvnich 30 sekundach.

Zdroj:

1. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
1. `docs/P0-core/contracts/aktivni/core/canonical-ux-ontology-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md`
8. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`

### 0.2 Co aktualni produkt porusuje

Soucasny FE-R1 mezistav porusuje cilovy smer takto:

1. promita backend pravdu jen textovou kartou,
2. hvezda neni hlavni interakcni objekt, ale jen pozadi za kartou,
3. governance lock se neodehrava uvnitr hvezdy,
4. spatial ontology neni citelna bez vysvetlovani,
5. wow moment je slaby a prevazne informacni.

### 0.3 Co se bude pocitat jako prijatelny dukaz dokonceni

Spatial FE-R1 bude prijatelny pouze pokud doda soucasne:

1. `technical completion`
   - stred workspace ovlada jedna prostorova `Star Core` sekvence,
   - governance data jsou navazana na BE truth adapter,
   - scena, kamera a diegeticke prvky jsou oddeleny od backend mapovani.
2. `user-visible completion`
   - po vstupu do workspace uzivatel vidi, ze se ve stredu prostoru rodi nebo stabilizuje hvezda,
   - governance `UNLOCKED` nebo `LOCKED` je citelna primo na nebo kolem hvezdy,
   - `Constitution Select` je patrny pred lockem,
   - dalsi krok je patrny bez cteni velke karty.
3. `documentation completion`
   - navazny implementacni dokument zretelne rusi panel-first smer,
   - obsahuje sekci `Pripraveny kod z archivu`.
4. `gate completion`
   - focused testy pro spatial state model,
   - before/after screenshoty `pred lock` a `po lock`,
   - explicitni seznam okamzite viditelnych rozdilu.

### 0.4 Co se za dokonceni nepocita

1. textova karta potvrzujici backend pravdu,
2. wow jen v copy nebo jen v glow bez governance smyslu,
3. lock bez `Constitution Select`,
4. navrat utility railu a side panelu,
5. scena, ktera stale funguje jako pozadi pro 2D panel,
6. uzavreni bloku bez spatialne citelne hvezdy ve stredu prostoru.

## 1. Ucel

Navrhnout od nuly prvni skutecny prostorovy workspace pohled po loginu tak, aby:

1. uzivatel vstoupil do fyzicke hranice sve galaxie,
2. uprostred prostoru vznikla nebo se stabilizovala hvezda,
3. uzamceni governance probehlo uvnitr hvezdy a je citelne jako prostorova udalost,
4. dalsi krok po locku vznikl jako fyzicky signal v prostoru, ne jen jako text.

## 2. Nazev konceptu

`Spatial Star-Core Ignition Experience`

To znamena:

1. workspace je scena, ne panelovy desktop,
2. hvezda je operacni autorita, ne ilustrace,
3. governance data jsou diegeticka vrstva kolem hvezdy,
4. prvni operacni rozhodnuti se odehrava ve stredu vesmiru,
5. plna cinematic sekvence se prehrava jen pri prvnim vstupu,
6. wow je podrizene `work first`.

## 3. Prostorove pilire

### 3.1 Prostorova ontologie

FE-R1 musi byt v souladu s touto hierarchii:

1. galaxie je hranice pracovniho prostoru,
2. hvezda je centralni zdroj zakonů a governance,
3. planety se objevuji az po uzamceni hvezdy,
4. mesice a dalsi capability vrstvy jsou az dalsi radialni uroven.

### 3.2 Diegeticke UI a holograficky HUD

FE-R1 smi pouzit jen tyto aktivni UI vrstvy:

1. diegeticky governance prstenec kolem hvezdy,
2. jemne plovouci labely nebo holograficke texty u hvezdy,
3. lehky taktický HUD na okrajich skla, pouze pokud nepřebiji stred.

Zakazano:

1. velka nepruhledna karta ve stredu,
2. pravy sidebar,
3. utility rail,
4. druhy top panel,
5. jakakoli konkurencni plocha, ktera bere stred hvezde.

### 3.3 Nedestruktivni realita

I v FE-R1 musi byt citelne, ze:

1. zmena governance nema charakter zaniknuti a prepsani,
2. lock je fyzicke zaklapnuti nebo stabilizace,
3. stav po locku je vizualne klidnejsi, stabilnejsi a bezpecnejsi.

### 3.4 Atmosfericke dimenze

FE-R1 jeste nemusi implementovat plne branch atmosfery, ale musi neporusit budoucnost:

1. scena musi umet nest tonalni zmenu prostoru,
2. svetlo a haze nesmi byt navrzene tak, aby branch tonalitu pozdeji znemoznily.

## 4. Spatial user flow prvnich 30 sekund

### 4.1 Nulty kontakt po loginu

Uzivatel po vstupu do workspace nesmi nejdriv cist panel.

Musi nejdriv videt:

1. tmavy prostor galaxie,
2. centralni energeticky fokus,
3. pocit, ze se neco deje uprostred prostoru.

Plna vision vrstva navic obsahuje `Nexus / Galaxy Selector` a fly-through.

Pro FE-R1 plati:

1. musi zustat kompatibilni s touto budouci sekvenci,
2. ale nemusi ji celou dorucit v jednom kroku.

### 4.2 Zrozeni hvezdy

Prvni skutecny wow moment FE-R1:

1. centralni fokus se stahuje a stabilizuje do hvezdy,
2. kamera nebo prostorovy framing potvrdi, ze tohle je centrum galaxie,
3. kolem hvezdy se rozvine governance prstenec.

Hvezda neni oslnive slunce.

Ma pusobit jako:

1. zkroceny fuzni reaktor,
2. energeticke jadro uvnitr strukturovane 3D geometrie,
3. zdroj zakonů, ne dekorativni objek.

### 4.3 Stav `pred lock`

Governance prstenec kolem hvezdy musi diegeticky ukazovat:

1. `GOVERNANCE: UNLOCKED`
2. `PHYSICS_PROFILE: ...`
3. `PULSE: STABILIZING`

Prvni akce:

1. uzivatel je veden do stredu hvezdy nebo primo na governance prstenec,
2. ne do textove karty,
3. ne do side panelu.

### 4.4 Constitution Select

Pred lockem musi uzivatel dostat kratky prostorovy krok vyberu ustavy.

Minimalni sada:

1. `Rust`
2. `Rovnovaha`
3. `Straz`
4. `Archiv`

Tento krok nesmi byt klasicky formular.

Musí byt vysvetlen:

1. pulzem hvezdy,
2. tonalitou prstence,
3. kratkou vetou o dusledku rezimu.

### 4.5 Policy lock

Uzamceni politik musi probehnout uvnitr hvezdy nebo na governance prstenci:

1. kurzor, fokus kamery nebo command affordance miri na `UNLOCKED`,
2. lehky HUD potvrdi akci `Potvrdit ustavu a uzamknout politiky`,
3. potvrzeni spusti fyzickou prostorovou animaci locku.

### 4.6 Stav `po lock`

Po uspesnem locku musi byt bez vysvetlovani citelne:

1. governance prstenec se zklidnil,
2. stav je `LOCKED` a `POLICY_READY`,
3. v prostoru se objevi prvni obezna draha nebo jiny orbitalni signal,
4. dalsi krok je zalozeni prvni planety.

Tohle je podstata FE-R1:

1. governance mela realny vizualni dusledek,
2. dalsi operacni moznost vznikla z prostorove udalosti.

## 4.7 Pravidlo prvniho prehrani

Plna cinematic sekvence se ma prehrat jen:

1. pri prvnim vstupu do nove galaxie,
2. pri prvnim onboarding kontaktu.

Po prvnim pruchodu musi byt:

1. defaultne vypnuta,
2. dalsi vstup ma byt zkraceny a pracovni,
3. replay ma byt jen na vyzadani.

## 5. Spatial kompozice

### 5.1 Co musi byt dominantni

Dominantni je jen:

1. hvezda,
2. governance prstenec,
3. `Constitution Select`,
4. jemny orbitalni nebo diegeticky signal dalsiho kroku.

### 5.2 Co smi byt sekundarni

Sekundarni smi byt jen:

1. lehky command prompt pri policy lock akci,
2. jemny globalni status v rohu skla,
3. drobne labely scope a sync.

### 5.3 Co je zakazane

1. centralni velka karta s textem,
2. boxy kolem hvezdy,
3. right rail,
4. stage-zero builder shell,
5. command workflow, ktery vizualne prevalcuje stred prostoru.

## 6. Co FE-R1 ma dodat

### 6.1 Wow moment

Wow moment musi vzniknout:

1. zrozenim nebo stabilizaci hvezdy,
2. kvalitou prostoru a kamery,
3. governance prstencem jako soucasti sveta,
4. `Constitution Select`,
5. viditelnym rozdilem `UNLOCKED` vs `LOCKED`.

### 6.2 Prvni operacni hodnota

Prvni operacni hodnota neni text.

Je to:

1. pochopeni, ze hvezda je autorita,
2. pochopeni, ze uzivatel urcuje ustavu prostoru,
3. pochopeni, ze policy lock je gate,
4. vizualni potvrzeni, ze po locku se otevrel orbitalni dalsi krok.

## 7. Co je mimo scope FE-R1

1. grid jako plny pracovni mod,
2. parser,
3. velky command bar workflow,
4. branch utility panel,
5. onboarding mise,
6. bond flow,
7. capability UI,
8. plny `Star Core` expert dashboard.

## 8. Pripraveny kod z archivu

Tento blok ma pripraveny archived kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se maji skutecne pouzit:

1. `UniverseCanvas.jsx` nebo jeho prostorove jadro,
2. `starContract.js`,
3. `lawResolver.js`,
4. `planetPhysicsParity.js`,
5. podle potreby `cameraPilotMath.js`,
6. podle potreby spatialni cast `previewAccessibility.js`.

V tomto bloku se zatim nemaji pouzit:

1. `WorkspaceSidebar.jsx`
2. `WorkspaceShell.jsx`
3. `useUniverseRuntimeSync.js`
4. `runtimeProjectionPatch.js`
5. `commandBarContract.js`
6. `useMoonCrudController.js`

Focused testy, ktere ma navrat helperu potvrdit:

1. `starContract.test.js`
2. `lawResolver.test.js`
3. `planetPhysicsParity.test.js`
4. nova aktivni `spatial first-view state model` test sada

## 9. Vazba na backend pravdu

FE-R1 pracuje s runtime daty, proto se musi ridit:

1. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

Pro FE-R1 to konkretne znamena:

1. diegeticky governance prstenec cte jen explicitne definovana `Star Core` pole,
2. `lock_status`, `law_preset`, `profile_mode`, `policy_version`, `locked_at` a fyzikalni profil jdou pres normalizer,
3. spatialni stavy `UNLOCKED`, `LOCKED`, `POLICY_READY`, `STABILIZING` nesmi vznikat z nahodneho UI copy,
4. pokud payload neni pripraveny, scena muze zustat v `stabilizing / unavailable` rezimu, ale nesmi predstirat lock.

## 10. Implementacni rozhodnuti

### 10.1 Co ma zustat z aktualniho cisteho zakladu

1. fullscreen cerny workspace,
2. hvezdne pozadi,
3. centralni svetelny fokus,
4. cistota bez legacy railu.

### 10.2 Co se ma nove dodelat

1. centralni 3D hvezda jako operacni jadro,
2. governance prstenec kolem hvezdy,
3. lehka orbitalni kamera nebo framing,
4. diegeticke labely `UNLOCKED/LOCKED`,
5. signal dalsi obezne drahy po locku.

### 10.3 Co se nesmi vratit

1. centralni textova karta jako hlavni FE-R1 surface,
2. `WorkspaceSidebar` pattern,
3. `Galaxy Navigator` chip logika,
4. `Fleet Control` utility rail logika,
5. stage-zero builder shell.

## 11. Gate a DoD

### 11.1 Technical completion

1. aktivni workspace ma spatialni `Star Core` sekvenci ve stredu,
2. governance stavy jsou oddelene od renderu modelem a adapterem,
3. aktivni FE pouziva jen schvalene archived helpery pro FE-R1.

### 11.2 User-visible completion

1. po loginu je bez klikani citelne, ze se ve stredu prostoru rodi nebo stabilizuje hvezda,
2. `pred lock` a `po lock` se lisi nejen textem, ale i prostorovym stavem,
3. dalsi krok je citelny v prostoru, ne jen v panelu,
4. first view ma wow i governance smysl zaroven.

### 11.3 Documentation completion

1. implementacni blok odkazuje na tento dokument,
2. ma sekci `Pripraveny kod z archivu`,
3. ma odkaz na `fe-be-pravda-a-data-guard-v1CZ.md`,
4. explicitne rusi panel-first smer.

### 11.4 Gate completion

1. focused testy pro spatial state model a truth adapter,
2. screenshot `pred lock`,
3. screenshot `po lock`,
4. explicitni seznam okamzite viditelnych spatialnich rozdilu,
5. audit, zda hvezda opravdu nese prvni akci,
6. audit, zda `Constitution Select` neni redukovany na textovy formular.

## 12. Evidence navrhu

Minimalni dukaz tohoto navrhu:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/core/canonical-ux-ontology-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md
```

## 13. Co zustava otevrene

- [ ] Po schvaleni tohoto spatial FE-R1 konceptu zapsat novy implementacni dokument.
- [ ] Po navazne implementaci dodat screenshoty a focused testy podle gate.
