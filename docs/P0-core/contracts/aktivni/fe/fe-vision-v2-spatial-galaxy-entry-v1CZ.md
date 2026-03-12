# FE vision v2 spatial galaxy entry v1

Stav: aktivni (nadrazeny FE vision smer)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 1. Ucel

Tento dokument urcuje nadrazeny smer frontend experience pro vstup do galaxie a pro prvni governance kontakt se `Star Core`.

Neni to implementacni checklist.

Je to referencni vision dokument, podle ktereho se hodnoti:

1. `Landing / Nexus`,
2. `workspace entry`,
3. `Star Core` onboarding,
4. budoucí FE-R1/FE-R2 bloky.

## 2. Zakladni principy

### 2.1 Prostorova ontologie

Frontend musi pusobit jako fyzicky prostor, ne jako panelovy desktop:

1. galaxie je hranice pracovniho prostoru,
2. hvezda je centralni zdroj zakonů a governance,
3. planety obihaji v prostoru az po potvrzeni hvezdy,
4. mesice a dalsi capability vrstvy navazuji az na planety.

### 2.2 Prace first

Priorita je `work first`.

To znamena:

1. nejdriv jasny stav,
2. nejdriv jasna akce,
3. nejdriv jasna ontologie,
4. teprve potom efekt.

Wow nesmi rozbit pracovni smysl.

### 2.3 Wow hlavne vizualem

Wow efekt ma vznikat predevsim:

1. kvalitou hvezdy,
2. prostorem,
3. svetlem,
4. diegetickym prstencem,
5. kamerou,
6. orbitalnimi stopami,
7. promenou `UNLOCKED -> LOCKED`.

Wow nema byt staven:

1. na velkem mnozstvi textu,
2. na tezkem panelovem HUD,
3. na preplnenych side rail ech,
4. na dlouhych vysvetlovacich blocich.

### 2.4 Diegeticke UI

Rozhrani ma byt co nejvic soucasti sveta:

1. governance data kolem hvezdy,
2. lehky holograficky HUD na skle,
3. command prompt jen jako doplnujici potvrzeni.

Velke nepruhledne centralni karty jsou proti teto vizi.

## 3. Vision flow

### 3.1 Nulty kontakt: `The Nexus / Galaxy Selector`

Obrazovce dominuje centralni 3D model:

1. hvezdokupa,
2. krystalicka struktura dat,
3. nebo rotujici mlhovina.

Model dycha a reaguje na pohyb kurzoru.

HUD na okrajich skla drzi:

1. seznam dostupnych galaxii,
2. stav galaxii,
3. akci `Inicializovat novou Galaxii`.

### 3.2 `Seamless transition`

Po zalozeni nebo prvnim vstupu do nove galaxie:

1. kamera proleti do centralniho modelu,
2. castice ustoupi,
3. uzivatel bez `Loading...` vstoupi do tmaveho prostoru galaxie,
4. pod nim se jemne rozsviti takticka mrizka,
5. v dalce blika holograficky majacek.

### 3.3 `Ignition sequence`

Majacek se zhrouti a zrodi hvezdu:

1. neni to klasicke slunce,
2. je to zkroceny fuzni reaktor,
3. jadro je uzavrene ve strukturovanem 3D poli,
4. kamera udela lehky orbit, aby uzivatel pochopil prostor.

### 3.4 `Star Core UI`

Kolem hvezdy se rozvine datovy prstenec.

Na nem se diegeticky promita:

1. `GOVERNANCE: UNLOCKED`
2. `PHYSICS_PROFILE: DEFAULT`
3. `PULSE: STABILIZING`

### 3.5 `Constitution Select`

Pred lockem musi existovat samostatny krok vyberu ustavy prostoru.

Uzivatel nema jit rovnou do `cvak a hotovo`.

Musí mit moznost vybrat nadcasovy rezim vesmiru, ktery bude vysvetlen dusledkem, ne formularem.

Minimalni sada:

1. `Rust`
2. `Rovnovaha`
3. `Straz`
4. `Archiv`

Kazdy rezim se vysvetluje:

1. pulzem hvezdy,
2. tonalitou prstence,
3. hustotou a charakterem energie,
4. kratkou vetou o dusledku pro svet.

### 3.6 `Policy Lock`

Teprve po volbe ustavy prichazi akce:

1. fokus na `UNLOCKED`,
2. lehky glass command prompt dole,
3. potvrzeni `Potvrdit ustavu a uzamknout politiky`.

### 3.7 `Lock-in`

Uzamceni se musi projevit fyzicky:

1. prstenec zaklapne,
2. barva se zmeni ze zlute na chladnou modrou,
3. hvezda se zklidni,
4. globální stav galaxie se prepise na `ONBOARDING_READY`.

### 3.8 `First Orbit`

Po locku se objevi prvni obezna draha:

1. jako fyzicky signal dalsiho kroku,
2. jako navadeni k umisteni prvni planety,
3. ne jen jako textove CTA.

## 4. Pravidlo prvniho prehrani

Plna cinematic sekvence se ma prehrat pouze:

1. pri prvnim vstupu do nove galaxie,
2. nebo pri prvnim onboarding kontaktu.

Po prvnim pruchodu musi byt:

1. defaultne vypnuta,
2. dalsi vstupy maji byt zkracene a pracovni,
3. hvezda se ma otevrit rovnou v aktualnim stavu.

## 5. Replay pravidlo

Uživatel musi mit moznost plnou sekvenci znovu zapnout nebo prehrat.

Ale jen jako volbu:

1. `Prehrat uvítaci sekvenci`
2. nebo podobny replay vstup v onboarding / nastaveni.

Replay nesmi byt vynuceny pri kazdem vstupu.

## 6. Accessibility guard

Vision musi uz ted obsahovat `reduced motion` pravidlo:

1. stejny vyznamovy sled zustava zachovan,
2. kamera je kratsi a mekci,
3. bez prudke akcelerace,
4. bez ztraty srozumitelnosti stavu.

## 7. Co z toho plati pro FE-R1

FE-R1 je prvni vykroj z teto vize.

Musi dorucit:

1. spatial `Star Core` ve stredu,
2. diegeticky governance prstenec,
3. `Constitution Select` pred lockem,
4. `Lock-in`,
5. `First Orbit`.

Nemusi jeste plne dorucit:

1. cely `Nexus / Galaxy Selector`,
2. plny dlouhy fly-through pro vsechny vstupy,
3. navazujici planet builder flow.

## 8. Co se nepocita jako soulad s vizi

1. textova karta pred hvezdou,
2. lock bez `Constitution Select`,
3. wow jen v textu a glow,
4. permanentni cinematic pri kazdem vstupu,
5. velke 2D panely, ktere berou stred hvezde.

## 9. Evidence

Minimalni dukaz teto vision verze:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/core/canonical-ux-ontology-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-r1-first-view-koncept-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-r1-implementacni-dokument-v1CZ.md
```

## 10. Co zustava otevrene

- [x] 2026-03-12 Vision v2 propsana do FE-R1 konceptu a implementacniho dokumentu.
- [ ] Pri dalsim FE bloku dodat spatialni implementaci `Constitution Select`.
