# Modelace interieru `Star Core`

Stav: aktivni (zavazny modelacni rozpad pro authored 3D prvky)
Datum: 2026-03-13
Vlastnik: uzivatel + FE agent
Rozsah: `Star Core interior`, authored hero objekty, prostorova skladba, FE integrace

## 1. Ucel

Tento dokument presne definuje jednotlive prvky pro modelaci interieru `Star Core`.

Cil:

1. oddelit modelacni praci od improvizovane proceduralni konstrukce,
2. zafixovat jeden jasny rozpad sceny na samostatne prvky,
3. zajistit, ze kazdy prvek bude umet stat samostatne a az potom se slozi do celku,
4. udrzet ontologickou cistotu: uzivatel je uvnitr `srdce hvezdy`, ne uvnitr planety, dashboardu nebo genericke sci-fi haly.

## 2. Ridici dokumenty

Tento dokument vykonava a zpresnuje:

1. `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-star-core-interior-ritual-chamber-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-blok-3a-star-core-interior-screen-implementacni-dokument-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`

Pravidlo:

1. pokud je rozpor mezi starsim FE prototypem a timto dokumentem, plati tento dokument,
2. tento dokument neurcuje API ani backend faze,
3. tento dokument urcuje pouze modelacni pravdu, prostorovou skladbu a vizualni roli prvku.

## 3. Globalni modelacni pravidla

### 3.1 Ontologie prostoru

Interier je:

1. vnitrni operacni komora uvnitr `srdce hvezdy`,
2. architektonicky a energeticky prostor,
3. misto governance a runtime orientace,
4. zivy ekosystem dat, ne staticka kulisa.

Interier neni:

1. planeta,
2. koule s prstenci,
3. control dashboard s 3D pozadim,
4. generic fantasy crystal room bez vazby na data a governance.

### 3.2 Globalni vizualni pravidla

1. hlavni informaci nese prostor, silueta, svetlo a pohyb,
2. text jen potvrzuje to, co uz je citelne vizualne,
3. kazdy modelovany prvek musi mit jasnou roli v orientaci nebo stavu,
4. zadny prvek nesmi byt pridan jen jako dekorace bez semantiky,
5. `work first` je nadrazen `wow`, ale `work first` nesmi skoncit jako chudy utilitarismus.

### 3.3 Globalni zakazy

Zakazano je:

1. centralni objekt citelny jako planeta,
2. dominantni horizontalni orbit kolem stredu,
3. dlouhe plovouci HUD pruhy pres hlavni fokus sceny,
4. elementy, ktere tvori prvni dojem jako tlacitka nebo karty,
5. prehnany efektovy sum, ktery zakryje orientaci.

## 4. Rozpad sceny na prvky

Zavazne poradi skladby:

1. `Scena 0: Cisty interier`
2. `Prvek A: Reactor Core`
3. `Prvek B: Governance Astrolabe`
4. `Prvek C: Live Pulse a telemetry architektura`
5. `Prvek D: Diegeticke interakcni uzly`
6. `Integrace`

Pravidlo:

1. dalsi prvek se integruje az kdyz predchozi obstal samostatne screenshotove,
2. pokud prvek samostatne nefunguje, nesmi se schovavat v celku.

## 5. `Scena 0: Cisty interier`

### 5.1 Role

Zajistit prostor, hloubku a orientaci bez zavislosti na hlavnim hero objektu.

### 5.2 Povinne komponenty

1. hlavni komora,
2. zadni hloubka nebo datova stena,
3. horni vstupni osa,
4. spodni kotva,
5. bocni nosne struktury nebo pylony.

### 5.3 Co musi uzivatel pochopit do 2-3 s

1. je uvnitr technologicko-ritualni komory,
2. prostor ma osu `nahore vstup / dole kotva / boky nosna architektura / uprostred fokus`,
3. nejde o otevreny vesmirny exterier.

### 5.4 Co je zakazane

1. prazdne nic bez orientace,
2. prehusta wireframe mriz,
3. plochy 2D overlay, ktery supluje architekturu.

## 6. `Prvek A: Reactor Core`

### 6.1 Role

Hlavni hero objekt celeho interieru. Je to fyzicke a energeticke `srdce hvezdy`.

### 6.2 Funkce v kompozici

1. okamzity fokus sceny,
2. nosic pulsu a stavu,
3. zdroj svetla a centralni autority prostoru.

### 6.3 Tvarova pravidla

Reactor Core musi byt:

1. vertikalne orientovany,
2. neplanetarni,
3. citelny jako reaktorovy seed, krystalicke jadro nebo disciplinovany energeticky artefakt,
4. asymetricky nebo vrstveny tak, aby nepusobil jako dokonala koule.

Reactor Core nesmi byt:

1. planeta,
2. mesic,
3. jednolita koule,
4. nahodny low-poly kamen bez vnitrni logiky.

### 6.4 Povinne vrstvy

1. `outer shell`
   - ochranna nebo disciplinacni vrstva,
   - poloprůhledna nebo krystalicka,
   - musi ukazat siluetu a hloubku.
2. `inner seed`
   - zive jadro,
   - nejjasnejsi bod objektu,
   - musi pusobit aktivneji nez obal.
3. `axial energy`
   - vertikalni osa nebo prutok energie,
   - podporuje orientaci prostoru,
   - nesmi prebit cely objekt.
4. `local particles / sparks`
   - jemne castice jen v tesnem okoli,
   - potvrzuji zivost,
   - nesmi se rozlezt po cele scene.

### 6.5 Materialovy jazyk

1. obal: chladne, disciplinovane, ciste materialy,
2. jadro: zivsi, svetelne aktivni a intenzivnejsi vrstva,
3. halo: jemne, ne mlzne a ne prepalene,
4. material ma pusobit premium, ne plastove nebo defaultne `PBR`.

### 6.6 Stavova citelnost

Reactor Core musi umet vizualne vyjadrit:

1. `constitution_select`
   - otevreny, hledajici, vice latentni stav,
2. `policy_lock_ready`
   - soustredeny, disciplinovany, klid pred uzamcenim,
3. `policy_lock_transition`
   - komprese, sevreni, zpevneni,
4. `first_orbit_ready`
   - stabilni a autoritativni rezim.

### 6.7 Dukaz kvality

Prvek A je kvalitni jen pokud:

1. funguje samostatne nad cistou komorou,
2. vypada jako hero objekt i bez ostatnich prvku,
3. nevyzaduje text, aby bylo jasne, ze jde o `srdce hvezdy`.

## 7. `Prvek B: Governance Astrolabe`

### 7.1 Role

Fyzicky governance mechanismus okoli jadra.

### 7.2 Funkce v kompozici

1. nese `Constitution Select`,
2. nese `Policy Lock`,
3. prevadi abstraktni zakonitosti na mechanicky, citelny akt.

### 7.3 Tvarova pravidla

Astrolab musi byt:

1. trezorovy nebo mechanicky,
2. segmentovany,
3. prostorove navazany na `Reactor Core`,
4. citelny jako disciplinacni mechanismus.

Astrolab nesmi byt:

1. planeta orbit system,
2. jemne nahodne kruznice,
3. dekorativni obruce bez funkce,
4. dominantni objekt, ktery zatlaci `Reactor Core`.

### 7.4 Povinne casti

1. hlavni governance ring nebo ringy,
2. segmenty nebo zarezy,
3. clamp / gate mechanika,
4. vazba na `constitution` volby.

### 7.5 Stavova pravidla

1. `constitution_select`
   - moznosti jsou otevrene a citelne oddelene,
2. `policy_lock_ready`
   - mechanismus se soustredi na jediny dalsi krok,
3. `policy_lock_transition`
   - fyzicke sevreni, dosednuti nebo zaklapnuti,
4. `first_orbit_ready`
   - mechanismus je uzamceny a zklidneny.

## 8. `Prvek C: Live Pulse a telemetry architektura`

### 8.1 Role

Pretavit backend metriky do fyzickych projevu prostoru.

### 8.2 Pravidlo

Kazda metrika musi neco delat.

To znamena:

1. nema byt jen cislo v HUD,
2. musi mit odpovidajici svetelnou, pohybovou nebo architektonickou projekci.

### 8.3 Zavazna mapa semantiky

1. `runtime.writes_per_minute`
   - hustota nebo rytmus axialniho toku,
2. `runtime.events_count`
   - mnozstvi lokalnich castic nebo mikrovyboju,
3. `domains`
   - bocni pylony, bohatost datove steny nebo boční signalni uzly,
4. `planetPhysics`
   - stabilita nebo napeti spodnich podpurnych struktur,
5. `pulse.lastEventSeq` a pribuzne signaly
   - puls centralniho holografickeho shluku.

### 8.4 Zakazy

1. metriky jako radka cisel bez prostorove role,
2. generic infobar pres spodni cast obrazovky,
3. telemetry vrstva, ktera prebije `Reactor Core` nebo `Astrolabe`.

## 9. `Prvek D: Diegeticke interakcni uzly`

### 9.1 Role

Nahradit bezna tlacitka a panelove ovladani za prvky, ktere patri do komory.

### 9.2 Povinne uzly

1. `constitution` vyberove uzly,
2. `lock` uzel nebo gesto,
3. `return` uzel.

### 9.3 Pravidla

1. interakcni prvek muze byt citelny jako akce, ale nesmi pusobit jako HTML button,
2. musi byt vizualne integrovany do prostoru,
3. musi byt pouzitelny i bez dlouheho vysvetlovani,
4. pouze jedna primarni akce smi byt v danem stavu dominantni.

## 10. Kamera, svetlo a material

### 10.1 Kamera

1. kamera ma podporit monumentalitu prostoru,
2. nesmi rozbit orientaci,
3. po vstupu musi dat rychle pochopeni osy prostoru,
4. idle pohyb smi byt jen jemny.

### 10.2 Svetlo

1. hlavni svetlo ma vychazet z `Reactor Core`,
2. vedlejsi svetla jen podporuji tvar a hloubku,
3. nesmi vzniknout prepalena bila skvrna bez materialu.

### 10.3 Material

1. povrchy musi mit rozdilne role:
   - jadro,
   - obal,
   - architektura komory,
   - governance mechanismus,
2. materialova hierarchie ma byt citelna i ve statickem screenshotu,
3. defaultni ploche materialy bez hloubky se nepovazuji za dostatecne.

## 11. Integracni pravidla

### 11.1 Poradi integrace

1. `Scena 0 + Prvek A`
2. `Scena 0 + Prvek A + Prvek B`
3. `Scena 0 + Prvek A + Prvek B + Prvek C`
4. `Scena 0 + Prvek A + Prvek B + Prvek C + Prvek D`

### 11.2 Hard stop pravidlo

Pokud po integraci novy prvek:

1. zhorsi orientaci,
2. prebije hero objekt bez duvodu,
3. vrati do sceny 2D nebo button-like dojem,
4. nebo se ztrati bez citelneho user-visible dopadu,

tak se blok neuzavira a prvek se vraci do samostatneho polish cyklu.

## 12. `OK / NOK`

### 12.1 `OK`

1. uzivatel do 2-3 s pozna, ze je v `srdci hvezdy`,
2. hlavni objekt se necte jako planeta,
3. governance pusobi jako fyzicky mechanismus,
4. data z backendu se projevuji ve scene, ne jen v textu,
5. akce jsou diegeticke a nepanelove.

### 12.2 `NOK`

1. koule s prstenci,
2. 3D pozadi a 2D UI popredi,
3. generic sci-fi dekorace bez semantiky,
4. prepalene glow fleky bez hmoty,
5. “funguje to technicky”, ale screenshot neni produktove presvedcivy.

## 13. Vstup pro authored kod / model

Kdyz uzivatel doda authored kod nebo model, musi byt mozne urcit:

1. ke kteremu prvku patri (`Scena 0`, `A`, `B`, `C`, `D`),
2. jaka je jeho role v kompozici,
3. ktere backend signaly na nej budou navazane,
4. co je jeho minimalni integracni kontrakt do FE sceny.

Minimalni handoff pro integraci ma obsahovat:

1. nazev prvku,
2. export nebo vstupni API,
3. zavislosti,
4. pozadovane parametry,
5. zakladni screenshot nebo slovni popis ocekavaneho vysledku.

## 14. Prakticke rozhodnuti pro dalsi postup

Od tohoto bodu plati:

1. authored kod nebo model se dodava po jednotlivych prvcich,
2. nejdriv se integruje `Prvek A`,
3. teprve po jeho schvaleni se otevre `Prvek B`,
4. dokumentacni a implementacni handoff se vzdy odkazuje na tento dokument jako modelacni pravdu.
