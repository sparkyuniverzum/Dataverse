# FE-R1 first-view koncept v1

Stav: aktivni (prisny navrh pred implementaci FE-R1)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 0. Pre-implementation kontrakt

### 0.1 Zavazne podminky prevzate z ridicich dokumentu

Tento navrh je zavazne hodnocen proti temto podminkam:

1. `Star Core first` je jediny spravny start noveho workspace.
2. FE-R1 musi dodat jednu autoritativni primarni akci.
3. Nesmime vratit stare panely po jednom bez nove architektury.
4. Prvni dojem musi vytvorit operating-center smer, ne „kde jsem?“ moment.
5. Pokud je konflikt scena vs operace, vyhrava operacni smysl, ne dekorace.
6. Pokud FE zacne cist runtime data, musi prokazatelne promítat BE pravdu.

Zdroj:

1. `docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md`
7. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`

### 0.2 Co aktualni produkt porusuje

Soucasny minimalisticky workspace po loginu:

1. ma atmosferu, ale nema autoritativni prvni akci,
2. nedava explicitni odpoved na `co mam udelat ted`,
3. nekomunikuje scope/mode/backend stav,
4. nevytvari jeste operating-center pocit,
5. v prvnich 30 s nedava produktovou hodnotu, jen cisty zaklad.

### 0.3 Co se bude pocitat jako prijatelny dukaz dokonceni

FE-R1 bude prijatelny pouze pokud doda soucasne:

1. `technical completion`
   - jedna centralni first-view surface,
   - zadny paralelni utility rail,
   - jasne stavy `pred lock` a `po lock`.
2. `user-visible completion`
   - po loginu je bez klikani jasne:
     - kde jsem,
     - proc je hvezda prvni krok,
     - jaka je primarni akce.
3. `documentation completion`
   - navazny implementacni dokument s `Pripraveny kod z archivu`.
4. `gate completion`
   - focused testy na state model first-view,
   - screenshoty `pred lock` a `po lock`,
   - explicitni seznam viditelnych rozdilu v prvnich 30 s.

### 0.4 Co se za dokonceni nepocita

1. jen helpery nebo tokeny bez user-visible rozdilu,
2. druhy panel se stejnou zprávou jako hlavni surface,
3. navrat side panelu nebo gridu „jen proto, ze chybi UI“,
4. cinematic efekt bez jasne prvni akce,
5. dokumentace bez realneho first-view dopadu.

## 1. Ucel

Navrhnout od nuly prvni aktivni workspace pohled po loginu tak, aby:

1. pusobil jako zacatek skutecneho operating center,
2. mel jeden dominantni fokus,
3. vedl bez zmatku na `Star Core`,
4. neprinesl zpet legacy balast.

## 2. Nazev konceptu

`Star Core ignition tableau`

To znamena:

1. scena nese wow moment,
2. hvezda je autorita,
3. jedna centralni surface vysvetluje prvni krok,
4. vse ostatni je podrizene tomuto momentu.

## 3. Konceptualni kompozice

### 3.1 Scena

Zaklad zustava:

1. tmavy vesmirny workspace,
2. hvezdne pole,
3. centralni svetelny fokus.

FE-R1 ho rozsiruje o:

1. skutecny `Star Core` objekt nebo jeho jasnou centralni reprezentaci,
2. jemny governance ring kolem hvezdy,
3. citelny stav `UNLOCKED` vs `LOCKED/POLICY_READY`.

Scena ma byt wow vrstva, ale ne editor.

### 3.2 Jedina dominantni surface

V centru musi byt pouze jedna autoritativni karta/shell:

1. titulek:
   - `Nejdřív nastav zákony hvězdy`
2. kratke proc:
   - nejdriv se urcuje chovani prostoru, teprve potom objekty v nem
3. tri realne stavove radky:
   - `Policy status`
   - `Law preset`
   - `Lock status`
4. jedno primarni CTA:
   - `Otevřít Srdce hvězdy`
5. jedna sekundarni pomocna akce:
   - `Proc je to prvni krok`

Zakazano:

1. pravy sidebar,
2. druhy top panel,
3. samostatny utility rail,
4. grid,
5. command workflow jako konkurencni prvni krok.

### 3.3 Minimalni globalni signal

Mimo dominantni surface smi zustat jen subtilni utility signal:

1. maly scope badge,
2. maly mode badge,
3. connectivity stav.

Pravidlo:

1. nesmi vzniknout dalsi „panel“,
2. ma to byt jen operator signal, ne druha navigacni plocha.

## 4. User flow prvnich 30 sekund

### 4.1 Stav A: po loginu, policy jeste neni locked

Uzivatel vidi:

1. hvezdny workspace s centralni hvezdou,
2. jedinou dominantni governance surface,
3. jednu jasnou primarni akci `Otevřít Srdce hvězdy`.

Uzivatel ma behem prvnich 5 sekund pochopit:

1. jsem ve workspace sve galaxie,
2. system jeste neni pripraveny na planety,
3. prvni krok je governance, ne stavba.

### 4.2 Stav B: po uspesnem policy lock

Po navratu ze `Star Core` se stejna dominantni surface zmeni:

1. titulek:
   - `Hvězda je uzamčena. Můžeš založit první planetu`
2. stav `LOCKED/POLICY_READY`
3. nova primarni akce:
   - `Založit první planetu`

To je kriticke:

1. FE-R1 neni jen vstup do hvezdy,
2. FE-R1 musi mit i navratovy `ready` stav,
3. uzivatel musi videt, ze governance mela realny dusledek.

## 5. Co FE-R1 ma dodat

### 5.1 Wow moment

Wow nema vzniknout mnozstvim UI, ale:

1. atmosferou centralni hvezdy,
2. kvalitou svetla a prostoru,
3. dojmem, ze uzivatel vstoupil do ridiciho jadra sve galaxie.

### 5.2 Prvni operacni hodnota

Prvni operacni hodnota neni jeste grid.

Je to:

1. pochopeni governance gate,
2. schopnost vstoupit do `Star Core`,
3. navrat do workspace s potvrzenym `policy-ready` stavem.

### 5.3 Jedna autoritativni primarni akce

Pred lock:

1. `Otevřít Srdce hvězdy`

Po lock:

1. `Založit první planetu`

V jednom okamziku nesmi byt aktivni obe jako primarni.

## 6. Co je mimo scope FE-R1

1. grid,
2. parser,
3. command bar jako plny operacni mod,
4. branch utility panel,
5. onboarding mise,
6. bond flow,
7. capability surface,
8. slozite recovery drawers.

## 7. Pripraveny kod z archivu

Tento blok ma pripraveny archived kod:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/planetPhysicsParity.js`
4. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceStateContract.js`
5. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceLayoutTokens.js`
6. `frontend/src/_inspiration_reset_20260312/components/universe/surfaceVisualTokens.js`
7. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomto bloku se maji skutecne pouzit:

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`
4. podle potreby `workspaceStateContract.js`

V tomto bloku se zatim nemaji pouzit:

1. `useUniverseRuntimeSync.js`
2. `runtimeProjectionPatch.js`
3. `commandBarContract.js`
4. `useMoonCrudController.js`
5. `parserComposerContract.js`

Focused testy, ktere ma navrat helperu potvrdit:

1. `starContract.test.js`
2. `lawResolver.test.js`
3. `planetPhysicsParity.test.js`
4. nova aktivni `first-view state model` test sada

## 8. Vazba na backend pravdu

FE-R1 pracuje s runtime daty, proto se musi ridit:

1. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

Pro FE-R1 to konkretne znamena:

1. first-view surface cte jen explicitne definovana `Star Core` pole,
2. `lock_status`, `law_preset`, `profile_mode` a dalsi governance udaje jdou pres normalizer, ne primo do UI,
3. zadny fallback nesmi prepsat realnou nulovou nebo prazdnou hodnotu,
4. pokud payload nedava smysl, UI musi rict, ze data nejsou pripravena, ne si je domyslet.

## 9. Implementacni rozhodnuti

### 9.1 Co ma zustat z aktualniho cisteho zakladu

1. fullscreen cerny workspace,
2. hvezdne pozadi,
3. centralni svetelny fokus,
4. celkova cistota bez legacy railu.

### 9.2 Co se ma nove dodelat

1. centralni `Star Core` reprezentace,
2. dominantni governance shell,
3. stavy `pred lock` a `po lock`,
4. subtilni scope/mode/connectivity signal,
5. jasne CTA switchovani podle realneho stavu.

### 9.3 Co se nesmi vratit

1. `WorkspaceSidebar` pattern,
2. `Galaxy Navigator` chip logika,
3. `Fleet Control` utility rail logika,
4. duplikovane top karty,
5. stage-zero builder shell.

## 10. Gate a DoD

### 10.1 Technical completion

1. aktivni workspace ma jednu dominantni centralni first-view surface,
2. stav `pred lock` a `po lock` je oddeleny modelem, ne copy ifem v monolitu,
3. aktivni FE pouziva jen schvalene archived helpery pro FE-R1.

### 10.2 User-visible completion

1. po loginu je bez klikani jasne, ze prvni krok je hvezda,
2. po locku je bez klikani jasne, ze dalsi krok je planeta,
3. neni pritomen zadny „kde jsem?“ moment,
4. first view ma wow i smysl zaroven.

### 10.3 Documentation completion

1. implementacni blok odkazuje na tento dokument,
2. ma sekci `Pripraveny kod z archivu`,
3. ma odkaz na `fe-be-pravda-a-data-guard-v1CZ.md`.

### 10.4 Gate completion

1. focused testy pro first-view model,
2. focused testy pro `Star Core` normalizaci,
3. screenshot `pred lock`,
4. screenshot `po lock`,
5. explicitni seznam viditelnych rozdilu v prvnich 30 s.

## 11. Evidence navrhu

Minimalni dukaz tohoto navrhu:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-reset-ramec-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-r1-priprava-audit-archivu-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md
sed -n '1,240p' docs/P0-core/contracts/aktivni/ux/ux-fe-risk-assessment-v1CZ.md
```

## 12. Co zustava otevrene

- [ ] Po schvaleni tohoto navrhu zalozit implementacni dokument FE-R1 s konkretnim scope `pred lock` + `po lock`.
- [ ] Po implementaci dodat screenshoty a focused testy podle gate.
