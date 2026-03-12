# FE Star Core Interior Ritual Chamber v1

Stav: aktivni (zavazny vizualni a interaction smer pro `Blok 3`)
Datum: 2026-03-12
Vlastnik: FE architektura + Produktove UX + user-agent governance

Pouzito v:

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`

## 1. Co se zmenilo

- [x] 2026-03-12 Byl schvalen novy vizualni smer `Ritual Chamber` pro `Star Core interior`.
- [x] 2026-03-12 Bylo explicitne zakazano pokracovat v panelovem, dashboardovem nebo formularovem layoutu interieru.
- [x] 2026-03-12 Byla zapsana spatial kompozice, interaction model a prisne `OK / NOK` pro dalsi FE implementaci.

## 2. Proc to vzniklo

Predchozi tri pokusy o `Star Core interior` potvrdily stejny problem:

1. architektura samostatne screen vrstvy byla technicky spravna,
2. ale vizualni jazyk sklouzl do tmave admin stranky,
3. 3D zustalo jen jako pozadi,
4. hlavni obsah tvorily boxy, metriky a CTA pruhy,
5. vysledek nebyl `Srdce hvezdy`, ale dashboard obaleny glow efektem.

To je pro aktivni FE smer neprijatelne, protoze:

1. `wow` ma byt neseny prostorem, svetlem, objektem a pohybem,
2. `work first` nesmi skoncit jako utilitarni panelovy layout,
3. `Star Core interior` ma byt fyzicke misto a ritualni operacni vrstva, ne settings page.

## 3. Ridici dokumenty

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/core/decision-log-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/core/context-handoff-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/core/new-thread-context-packet-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
5. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
6. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`
7. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`
8. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`
9. `docs/P0-core/contracts/aktivni/ux/ux-fe-component-behavior-contract-v1CZ.md`

Pravidlo:

1. pokud je rozpor mezi starsim FE prototypem a timto dokumentem, plati tento dokument,
2. `Blok 3a` resi screen oddeleni a transition kontrakt,
3. tento dokument urcuje, jak ma interior pusobit produktove a prostorove,
4. bez souladu s timto dokumentem se `Blok 3` nesmi prezentovat jako user-visible uspech.

## 4. Pre-implementation kontrakt

### 4.1 Zavazne podminky

Pro dalsi implementaci `Star Core interior` plati jako hard gate:

1. `Star Core interior` je samostatna pracovni obrazovka, ne dalsi zoom uvnitr `Galaxy Space`.
2. Interior nesmi byt panelova stranka, dashboard, formular ani admin shell.
3. Hlavni informacni nosic je prostorovy objekt, svetlo, orbit a pohyb, ne textovy box.
4. `Constitution Select` se musi cist jako fyzicka volba rezimu prostoru, ne seznam karet.
5. `Policy Lock` se musi cist jako fyzicky akt uzamceni, ne obycejne potvrzovaci tlacitko v panelu.
6. `First Orbit Ready` se musi projevit vznikem nove drahy v prostoru, ne jen statusem nebo badge.
7. FE nesmi drzet canonical workflow truth mimo backend contract.

### 4.2 Co aktualni nebo predchozi smer porusoval

Predchozi FE smer porusoval tyto podminky:

1. dominantni byly sekce, boxy a textove explanation bloky,
2. 3D bylo degradovano na dekorativni background,
3. layout pripominal tmavou admin stranku,
4. `lock` pusobil jako CTA control, ne jako udalost v prostoru,
5. `first_orbit_ready` se cetlo jako metrika nebo report, ne jako nova fyzicka vrstva reality.

### 4.3 Co bude prijatelny dukaz dokonceni

Za prijatelny dukaz pro dalsi FE bloky se pocita jen kombinace:

1. before/after porovnani proti panelovemu smeru,
2. screenshoty stavu, kde hlavni obsah nese 3D kompozice, ne box layout,
3. focused testy pro stavovou logiku a screen transition,
4. explicitni seznam okamzite viditelnych rozdilu,
5. potvrzeni, ze interior stale cte canonical backend faze.

### 4.4 Co se za dokonceni pocitat nebude

Za dokonceni se nepocita:

1. tmava stranka s lepsim glow efektem,
2. 3D pozadi za kartami,
3. modal pres `Galaxy Space`,
4. hezci CSS bez zmeny prostorove kompozice,
5. `lock` reseny jako bezne tlacitko v panelu,
6. `first_orbit_ready` reseny jako dalsi info sekce.

## 5. Vizuální smer: `Ritual Chamber`

### 5.1 Hlavni idea

`Star Core interior` ma pusobit jako ritualni operacni komora uvnitr srdce hvezdy.

Operator nevstupuje na stranku se sekcemi.

Operator vstupuje do ziveho energetickeho prostoru, kde:

1. jadro reaguje na vybranou ustavu,
2. okolo jadra obihaji ustavni proudy,
3. lock je fyzicke sevreni governance prstence,
4. prvni orbita se rodi jako vizualni nasledek potvrzeneho radu.

### 5.2 Kompozice obrazovky

Kompozice ma byt vedena takto:

1. stred obrazovky:
   - zive `Srdce hvezdy`,
   - puls, hustota svetla, vrstevnice energie,
   - nejsilnejsi fokus celeho interieru.
2. stredni vrstva:
   - jeden nebo vice energetickych prstencu,
   - orbitujici ustavni proudy,
   - zretelne citelna aktivni volba.
3. periferie:
   - velmi lehke diegeticke popisky a signalni copy,
   - zadne tezke karty nebo dashboard sloupce.
4. hrany obrazovky:
   - minimalni shell pro navrat a stav vrstvy,
   - nic, co by vizualne porazilo jadro.

### 5.3 Vizuální hierarchy

Poradi dominant ma byt:

1. jadro a jeho stav,
2. orbitalni volba,
3. lock gesto,
4. vznik prvni orbity,
5. kratka diegeticka copy.

Nesmi vzniknout hierarchie:

1. headline,
2. box s textem,
3. dalsi box s metrikami,
4. CTA button,
5. a teprve potom 3D dekorace.

## 6. Interaction model

### 6.1 `constitution_select`

Implementacni smer:

1. ctyri ustavni rezimy se maji cist jako ctyri prostorove proudy nebo orbitalni archetypy,
2. kazdy rezim meni:
   - tonalitu,
   - rytmus pulsu,
   - hustotu castic,
   - geometrii prstence,
   - charakter svetla uvnitr komory.
3. vyber nema byt seznam karet ani panel,
4. operator ma pocit, ze zachycuje jednu moznost budoucnosti prostoru.

### 6.2 `policy_lock_ready`

Implementacni smer:

1. po vyberu se ma prostor zklidnit a soustredit na jediny dalsi krok,
2. lock affordance ma vyrust z jadra a prstence, ne z paneloveho CTA,
3. ma byt zrejme, ze po locku uz se komora fyzicky preusporada,
4. porad plati jen jedna primarni akce.

### 6.3 `policy_lock_transition`

Implementacni smer:

1. uzamceni ma byt fyzicke sevreni nebo dosednuti governance prstence,
2. svetlo ma prejit z otevreneho stavu do disciplinovaneho, stabilniho rezimu,
3. energie se nema rozsypat do konfety efektu,
4. prechod ma pusobit vazne a autoritativne.

### 6.4 `first_orbit_ready`

Implementacni smer:

1. po potvrzeni se objevi prvni stabilni draha,
2. draha je hlavni dukaz, ze vznikl dalsi krok prostoru,
3. uzivatel nema cist report, ale videt vysledek,
4. copy jen potvrzuje to, co uz orbitalni vrstva rekla sama.

## 7. `OK / NOK` auditni zapis

### 7.1 `NOK`

Nasledujici smer je v tomto bloku zakazany:

1. velke obsahove boxy pres vetsi cast obrazovky,
2. dvousloupcovy dashboard layout,
3. sekce `metrics`, `signal`, `summary` jako hlavni UI struktura,
4. dlouhy CTA pruh pres spodni cast panelu,
5. `3D background + content card` kompozice,
6. text, ktery vysvetluje prostor misto toho, aby ho podporoval.

### 7.2 `OK`

Nasledujici smer je v souladu s cilem:

1. centralni zivy objekt jako hlavni operacni fokus,
2. orbity a prstence jako nosice volby a zmeny stavu,
3. minimalni diegeticke copy ukotvene pri hrane nebo v prostoru,
4. fyzicky citelny prechod `vyber -> lock -> nova orbita`,
5. vizualni odliseni ustav pres svetlo, rytmus a tvar, ne jen pres text,
6. interior, ktery stale vypada jako nastroj, ale neni utilitarni panel.

## 8. Motion, UX a performance pravidla

### 8.1 Motion

1. pohyb ma byt plynuly, ale disciplinovany,
2. zadne bezduvodne filmove prejezdy,
3. kazda animace musi neco oznamovat:
   - vyber,
   - koncentraci energie,
   - uzamceni,
   - vznik orbity.

### 8.2 Reduced motion

Reduced-motion varianta musi:

1. zachovat stejnou vyznamovou sekvenci,
2. zkratit pohyb, ne logiku,
3. zachovat citelnost `vyber -> lock -> orbit`.

### 8.3 Performance

1. hlavni interier nesmi byt zaboren prehnanou postprocessing mlhou,
2. efektova vrstva nesmi rozbit selection nebo lock feedback,
3. opakovane zmeny ustavy nesmi shazovat celou screen kompozici,
4. frame budget ma zustat v souladu s aktivnim behavior kontraktem.

## 9. Vazba na backend pravdu

Tento vizualni smer nic nemeni na canonical pravde:

1. `GET /galaxies/{galaxy_id}/star-core/interior`
2. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
3. `POST /galaxies/{galaxy_id}/star-core/policy/lock`
4. `GET /galaxies/{galaxy_id}/star-core/policy`
5. `GET /galaxies/{galaxy_id}/star-core/physics/profile`

Pravidlo:

1. FE smi umet navrhnout prostorovou projekci techto fazi,
2. FE nesmi vymyslet nove finalni workflow faze mimo payload,
3. kdyz backend nevrati jasny stav, FE nesmi optimisticly kreslit uzamceny ritual.

## 10. Pripraveny kod z archivu

Aktivni reuse mapa:

1. `docs/P0-core/contracts/aktivni/fe/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

Pro tento smer jsou pripravene hlavne:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/lawResolver.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`
4. `frontend/src/components/universe/starCoreTruthAdapter.js`
5. `frontend/src/components/universe/starCoreInteriorAdapter.js`

Audit archivu pro tento blok:

1. `OK` `starContract.js`
   - proc: drzi stavovou pravdu hvezdy a je vhodny pro projekci jadra.
   - co prevzit: normalizaci stavovych signalů pro jadro a exterier navrat.
2. `OK` `lawResolver.js`
   - proc: umi cist ustavni a policy signal bez panelove UI logiky.
   - co prevzit: mapovani ustav na tonalitu, vysvetlitelnost a rezimove rozdily.
3. `OK` `previewAccessibility.js`
   - proc: podpori reduced-motion a fallback signal bez degradace vyznamu.
   - co prevzit: jen a11y helpery.
4. `NOK` `QuickGridOverlay.jsx`
   - proc: tahne blok do grid operation vrstvy.
   - co odstranit: nulove reuse v interieru.
5. `NOK` `GovernanceModeSurface.jsx`
   - proc: vracel by panelovou kompozici.
   - co odstranit: nevracet do aktivni cesty.
6. `NOK` archivni dashboard a setup panely
   - proc: porusuji `Ritual Chamber` smer.
   - co odstranit: nepouzivat jako inspiraci ani rozlozeni.

## 11. Implementacni dusledky pro dalsi blok

Nasledujici FE blok ma respektovat toto poradi:

1. nejdriv finalizovat `Blok 3a` shell, transition a return contract,
2. potom promítnout `Ritual Chamber` kompozici do interior screen,
3. teprve nad ni doplnit canonical `constitution_select`,
4. potom `policy_lock_ready`,
5. potom `policy_lock_transition`,
6. nakonec `first_orbit_ready`.

Pravidlo:

1. pokud implementace znovu zacne kompozicne padat do panelu, blok se zastavi a vrati k tomuto dokumentu,
2. pokud FE nebude umet udrzet prostorovou citelnost bez panelu, nema se to obchazet dashboardem.

## 12. Focused gate

### 12.1 User-visible gate

Blok se nesmi uzavrit, pokud:

1. hlavni fokus netvori jadro a orbitalni vrstva,
2. interior stale pripomina dashboard nebo tmavy formular,
3. `constitution_select` se bez textu neda cist jako volba rezimu prostoru,
4. `policy_lock` bez vysvetleni nevypada jako fyzicky akt uzamceni,
5. `first_orbit_ready` neni viditelny jako nova draha nebo nova prostorova vrstva.

### 12.2 Screenshot gate

Povinne screenshoty:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`
6. explicitni porovnani proti predchozimu panelovemu smeru

### 12.3 Focused test gate

Minimalni focused sada:

1. `StarCoreInteriorScreen.test.jsx`
2. `starCoreInteriorScreenModel.test.js`
3. `starCoreInteriorAdapter.test.js`
4. test reduced-motion varianty,
5. test, ze interior screen nevraci panelovy fallback layout,
6. test, ze `onReturnToSpace` a canonical phase synchronizace zustavaji konzistentni.

## 13. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-star-core-interior-ritual-chamber-v1CZ.md
```

Vysledek:

- [x] 2026-03-12 Aktivni FE pravda pro interior uz explicitne zakazuje panelovy smer.
- [x] 2026-03-12 Byl zapsan jednotny `Ritual Chamber` smer pro dalsi navrh a implementaci.

## 14. Co zustava otevrene

- [ ] Prevest `Blok 3a` runtime shell do vizualni kompozice `Ritual Chamber`.
- [ ] Dodat focused screenshoty a validovat, ze interier uz nepusobi jako dashboard.
- [ ] Dopsat navazny implementacni blok pro plny `Constitution Select -> Policy Lock -> First Orbit`.
