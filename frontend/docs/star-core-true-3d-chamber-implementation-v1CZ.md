# Star Core Interior: True 3D Chamber Rewrite v1CZ

Status: official FE implementation document

Date: 2026-03-16

Owner: FE

Purpose:

- zafixovat finalni implementacni smer pro Star Core Interior,
- ukoncit drift mezi "2.5D hero page" a "true 3D chamber experience",
- dat FE jasny prostorovy stavebni plan pro dalsi rewrite.

## 1. Chamber Geometry Rewrite

### Cíl

Prestavet aktualni front-facing kompozici na skutecny interier monumentalni komory, ve ktere je kamera pritomna.

### Výsledek

Scena musi pusobit jako architektura, ne jako objekt pred pozadim.

### Povinne prostorove vrstvy

#### `foreground_frame`

- vrstva mezi kamerou a jadrem
- obsahuje casti konstrukce, ktere obcas vstupuji do zaberu
- musi vytvaret occlusion a meritko

#### `mid_chamber`

- hlavni operacni prostor
- drzi constitution anchors
- drzi seal mechanismus
- nese hlavni citelnost ritualu

#### `core_cradle_zone`

- centrální zona s reaktorem
- musi byt fyzicky svazana s okolni architekturou

#### `rear_depth`

- zadni stena nebo shaft
- svetelne studny
- vzdalene ring lattice
- hlubkove vrstvy mlhy

### Povinne mesh skupiny

#### Foreground

- `fg_brace_left`
- `fg_brace_right`
- `fg_hanging_rail_top`
- `fg_hanging_rail_bottom`
- `fg_seal_arm_left`
- `fg_seal_arm_right`

#### Mid chamber

- `mid_outer_ring_segments`
- `mid_inner_ribs`
- `mid_anchor_pedestals`
- `mid_walk_arc` nebo `mid_platform_traces`

#### Core cradle zone

- `core_primary_cradle`
- `core_secondary_cradle`
- `core_tether_lines`
- `core_reaction_field`

#### Rear depth

- `rear_wall_shell`
- `rear_shaft_ring_a`
- `rear_shaft_ring_b`
- `rear_light_well_planes`
- `rear_lattice_segments`

### Prostorove role

#### Foreground

- z rozsahu zhruba `z: +1.0 až -2.0` relativne ke kameře
- nesmi blokovat stred trvale
- ma jen obcas cist cast scene a dat citelny pocit "jsme uvnitr"

#### Mid chamber

- zhruba `z: -2.0 až -7.0`
- zde probiha ritual
- zde jsou anchor body

#### Core cradle zone

- zhruba `z: -4.0 až -8.0`
- musi byt opticky nejsilnejsi oblast

#### Rear depth

- zhruba `z: -8.0 až -20.0`
- nesmi byt placka
- musi obsahovat vic jak jednu hloubkovou rovinu

### Animation rules

- `ritual`: lehka nesouosost, latentni napeti, mikro-disorder
- `lock_transition`: architektura se srovnava do os
- `observatory`: geometrie stabilni, klidna, pravidelna

### Zakazy

- zadne front-plane UI sloupy predstirajici prostor
- zadne dekorativni ringy bez role v komore
- zadne "background plate" resici zadni stenu samo o sobe

### Done

- scena bez HTML stale cte chamber logiku
- foreground dava occlusion
- midground nese interakci
- background dava hloubku

## 2. Core + Cradle Rewrite

### Cíl

Zmenit centralni objekt z izolovaneho vizualu na centrum fyzicky ukotveneho chamber systemu.

### Povinna skladba

#### `core_mass`

- hlavni energeticka hmota
- unlocked: amorfni, nestabilni, nepravidelna
- locked: stazena, disciplinovanejsi, rytmicka

#### `containment_shell`

- opticky obal kolem core
- musi citelne reagovat na chaos/order

#### `primary_cradle`

- hlavni nosna konstrukce kolem core
- musi drzet core jako aktivni mechanismus, ne jako vystaveny artefakt

#### `secondary_supports`

- dalsi podpory, tethery, seal conduits
- maji cist vazbu mezi architecture a core

### Motion rules

#### Ritual

- core field je turbulentni
- containment shell ma jemnou deformaci
- cradle je pod napetim

#### Lock transition

- turbulence prudce klesa
- shell se zarovna
- cradle dosedne do finalni osy

#### Observatory

- core pulsuje pomalu a pravidelne
- shell je klidny
- cradle pusobi monumentalne a pasivne

### Material rules

- nepouzivat "sci-fi toy" materialy
- sklo/transmission pouze tam, kde podpori pocit posvatne technologie
- emissive musi byt disciplinovane
- jiskry a sparkles nesmi byt hlavni efekt

### Done

- core pusobi jako srdce chamber systemu
- bez cradle by scena nedavala smysl
- zmena chaos -> order je citelna na centralnim mechanismu

## 3. Constitution Anchors In-World

### Cíl

Presunout volbu ustavy do prostoru.

### Povinne pravidlo

Konstituce nesmi byt primarne vysvetlena 2D kartami. Musi byt citelna pres world anchors.

### Anchor systém

#### Pocet

- presne 4 aktivni anchors v ritual modu

#### Umisteni

- kolem core v mid chamber vrstve
- ne ve stejne rovine
- kazdy anchor musi mit vlastni prostorovy offset

#### Identita

- kazdy anchor dostane:
  - vlastni silhouette
  - vlastni glow signaturu
  - vlastni tvar pedestalu nebo nosice

### Povinne skupiny

- `anchor_origin`
- `anchor_flux`
- `anchor_sentinel`
- `anchor_archive`

### Interaction rules

- klik target je mesh nebo group ve svete
- hover:
  - zvyseni emissive
  - lehky scale shift
  - jemna lokalni aktivace pole
- selected:
  - anchor je jednoznacne dominantni
  - ostatni anchors zustanou ciselne pritomne, ale ustoupi

### Camera relation

- pri hover/select muze kamera lehce biasnout pohled
- nesmi to byt velky cut
- ma to pusobit jako "attention shift", ne modalni prepnuti

### HTML fallback

- maly context strip muze ukazat jmeno a 1 vetu
- nesmi nahradit in-world citelnost anchoru

### Done

- anchor selection funguje bez velkych HTML cards
- i bez textu je zrejme, ktere body jsou ritually active

## 4. Lock Interaction In-World

### Cíl

Lock se musi cist jako mechanismus komory, ne jako web button nalepeny pres canvas.

### Mechanismus

Preferovany model:

- centralni `seal_ring`
- 4 `seal_clamps`
- readiness signal po selected constitution

### Stavovy průběh

#### Before ready

- seal mechanismus je pritomny, ale neaktivni
- clampy nejsou dosedle

#### Ready

- po vyberu constitution se seal mechanismus rozsviti
- clampy se prepnou do "ready to engage"
- kamera a svetlo daji uzivateli vedet, ze dalsi krok je seal

#### Lock transition

- klik na seal mechanismus spusti lock
- clampy se posunou
- ring se zarovna
- core field se stahne

### HTML role

- povolen je jen maly hint typu:
  - `Seal ready`
  - `Click core seal to lock`
- nepovoluje se dominantni CTA karta

### Done

- uzivatel cte lock jako in-world ritual
- hlavni akce je jasna bez velkeho overlay tlacitka

## 5. Minimal HTML Shell

### Cíl

Udelat z HTML jen doplnkovou orientacni vrstvu.

### Povolené HTML

- maly state label
- maly context strip
- pripadne maly lock hint

### Nepovolené HTML

- velke constitution cards kolem canvasu
- right-side explainery jako hlavni nosic vyznamu
- velke CTA boxy, ktere nahrazuji in-world mechanismus

### Maximalni HTML role

- doplnit to, co scena uz komunikuje
- ne vysvetlit ritual za ni

### Test pravidlo

Kdyz se skryje vetsina HTML, scena stale musi byt smysluplna.

### Done

- HTML slouzi orientaci
- 3D scena nese hlavni zkusenost

## 6. Camera Choreography

### Cíl

Kamera musi byt participant inside chamber.

### Povinne rezimy

#### `entry`

- kamera vstupuje skrz architektonicky ramec nebo tunel
- musi vzniknout pocit "prunik dovnitr"

#### `idle_ritual`

- kamera lehce off-axis
- jemny drift
- cte foreground a midground vrstvy

#### `anchor_focus`

- po hover/select lehky bias ke zvolenemu anchoru
- bez tvrdeho cutu

#### `lock_transition`

- kratky push-in
- stabilizace horizontu
- ustup chaos micro-motion

#### `observatory_idle`

- kamera klidnejsi
- prostor porad monumentalni
- mene napeti, vice radu

### Technicka pravidla

- kamera nesmi byt trvale ciste front-facing
- lookAt target nesmi byt fixni bez scene-state vlivu
- movement musi odhalovat parallax

### Done

- i maly pohyb kamery odhaluje hloubku a meritko
- kamera pusobi jako pritomny ucastnik ritualu

## 7. Test Contract Rewrite

### Cíl

Prepsat testy tak, aby chranily spatial contract misto stare HTML-heavy kompozice.

### Povinne FE kontrakty

- minimal HTML shell existuje
- ritual vs observatory stavy drzi
- in-world constitution interaction hooks existuji
- in-world seal mechanismus existuje ve spravne fazi
- observatory nema write entry side effect

### Co uz neni kanonicky kontrakt

- velke overlay karty
- dashboard-like right rail
- HTML-first CTA layout

### Testy

#### Unit

- `starCoreInteriorVisualModel`
  - camera mood
  - anchor activation state
  - seal readiness state
- `StarCoreInteriorScreen`
  - minimal HTML shell only
  - mode visibility rules
- `UniverseWorkspace`
  - locked entry bez write side effectu zustava zachovany

#### Visual contract

- overit, ze ritual obsahuje:
  - scene
  - minimal label
  - minimal context strip
- overit, ze observatory neobsahuje ritual affordance

### Done

- testy chraní chamber pravdu, ne page layout minulosti

## Scene Blueprint pro `starCoreInteriorScene3d.jsx`

### A. Camera

#### Start

- kamera zacina mimo chamber entrance frame
- pozice orientacne:
  - `entry_start = [0, 1.6, 16.0]`
  - `entry_mid = [0.4, 1.1, 10.5]`
  - `ritual_idle = [1.1, 0.7, 8.2]`

#### Look targets

- `entry_look = [0, 0.6, -2]`
- `ritual_look = [0, 0.2, -5.8]`
- `anchor_focus` podle vybraneho anchoru

#### Idle drift

- `x`: velmi mala amplituda
- `y`: jemne dychani
- `lookAt`: jemny noise offset

### B. Foreground frame

#### Funkce

- vytvori pritomnost kamery uvnitr chamber
- obcas prekryje cast pohledu

#### Komponenty

- `ChamberBraceGroup`
- `EntranceRailGroup`
- `SealArmForegroundGroup`

#### Pozicni role

- cast prvku musi byt bliz kameře nez core
- nektere prvky muze kamera minout pri entry

### C. Mid chamber

#### Funkce

- hlavni ritualni prostor
- drzi interakci a orientaci

#### Komponenty

- `ChamberRingAssembly`
- `AnchorPedestalGroup`
- `InnerRibAssembly`
- `SealRingAssembly`

#### Pozicni role

- okolo core
- ne vse v jedne rovine
- anchors rozmistit v 3D, ne jen do kruhu v jedne vysce

### D. Background

#### Funkce

- dava monumentalni meritko
- zavira chamber

#### Komponenty

- `RearShell`
- `RearShaftRings`
- `LightWellPlanes`
- `DistantLattice`

#### Atmosfera

- mlha
- hlubkove svetlo
- locked rezim = citelnejsi osa
- ritual rezim = lehce rozhazena symetrie

### E. Core chamber

#### Komponenty

- `CoreMass`
- `ContainmentShell`
- `PrimaryCradle`
- `SupportTethers`
- `ReactionField`

#### Pravidlo

- core nesmi pusobit, ze plave ve vakuu
- musi byt zrejme, co ho drzi a proc je uprostred komory

### F. Constitution anchors

#### Komponenty

- `ConstitutionAnchorGroup`
- `AnchorPedestal`
- `AnchorGlyphMesh`
- `AnchorHalo`

#### Interaction

- pointer events pouze na world anchors
- screen shell muze ukazat selected state, ale ne nahradit anchor

### G. Lock interaction

#### Komponenty

- `SealRing`
- `SealClampGroup`
- `SealCoreTrigger`

#### Ready logic

- visible/active jen kdyz constitution selection dava smysl
- visual ready state musi byt silny i bez textu

### H. Minimal HTML

#### Povolit

- `state_label`
- `context_strip`
- `seal_hint`

#### Nepovolit

- card walls kolem scene
- panelovou navigaci uvnitr Star Core

## Realizační pořadí

1. scene geometry rewrite
2. core + cradle rewrite
3. constitution anchors in-world
4. lock interaction in-world
5. minimal HTML shell
6. camera choreography
7. test contract rewrite

## Block Close Standard

Kazdy z techto 7 kroku se zavira jen tehdy, kdyz plati:

- technical completion
- user-visible completion
- documentation completion
- gate completion

## 1A: Rear Depth Field Blueprint

Status: approved blueprint

Purpose:

- vytvorit hluboke neuzavrene pole v zadni casti chamber,
- zrusit citelny konec prostoru,
- pripravit chamber pro dalsi geometrii bez navratu pseudo-3D stredu.

### Cíl

`Rear Depth Field` neni zadni stena.
Je to hloubkove pole, ktere deformuje vnimani prostoru.

Musi:

- odstranit citelny "back wall",
- natahnout prostor hloubeji, nez realne je,
- vest oko smerem, ne hranici,
- fungovat bez core, anchoru i seal mechanismu.

### Skladba systemu

`Rear Depth Field` se sklada ze 3 systemu:

1. `deformed depth layers`
2. `directional memory light`
3. `depth-scale fog`

### A. Deformed Depth Layers

#### Účel

Nahradit zadni stenu nejasnym vrstvenym polem.

#### Povinne vrstvy

1. `depth_layer_near`
2. `depth_layer_mid_a`
3. `depth_layer_mid_b`
4. `depth_layer_far_a`
5. `depth_layer_far_b`

#### Pravidla

- zadna vrstva nesmi byt cista front-facing plane wall,
- kazda vrstva musi byt lehce natocena nebo zakrivena,
- vrstvy nesmi byt souose,
- vrstvy nesmi mit stejnou velikost ani stejnou orientaci.

#### Tvarovy jazyk

Preferovat:

- `depth membranes`
- `partial shell fragments`
- `arc planes`
- `warped field surfaces`

Nepreferovat:

- `rear wall`
- `rectangular room backplane`
- `single portal ring`

#### Osa

- hlavni hloubkova osa je lehce mimo stred,
- nesmi vzniknout sterilni centralni symetrie.

#### Hloubkove pasmo

- `near depth field`: zhruba `z -8 az -11`
- `mid depth field`: zhruba `z -11 az -16`
- `far depth field`: zhruba `z -16 az -24`

### B. Directional Memory Light

#### Účel

Svetlo neni dekorace.
Je to stopa smeru a historie procesu.

#### Povinne typy

1. `memory_beam_primary`
2. `memory_beam_secondary`
3. `memory_shards`

#### Pravidla

- ne rovne sci-fi sloupy,
- ne symetricke dvojice,
- ne rovnomerna intenzita po cele delce,
- proudy musi pusobit jako vektorova pamet pole.

#### Chovani

`primary`

- nejdelsi proud,
- lehce diagonalni,
- smeruje priblizne do budouciho centra, ale nekonci v nem.

`secondary`

- kratsi prerusovane vrstvy,
- odchyluji se od primarniho smeru,
- pusobi jako echo nebo zbytek predchoziho vedeni.

`shards`

- male fragmenty v hloubce,
- jen stopovy signal, ne particle efekt.

#### Budouci navaznost

- `ritual`: proudy rozvolnene a nesynchronni,
- `lock_transition`: proudy se zarovnavaji,
- `observatory`: proudy disciplinovane a klidne.

### C. Depth-Scale Fog

#### Účel

Fog neni atmosfera.
Fog je nastroj meritka a vzdalenosti.

#### Povinne bandy

1. `fog_near`
2. `fog_mid`
3. `fog_far`

#### Pravidla

`fog_near`

- skoro neviditelny,
- nesmi budoucne zabijet foreground.

`fog_mid`

- oddeli stredni a vzdalenou hloubku,
- pomuze cist vrstvy prostoru.

`fog_far`

- rozbije konec prostoru,
- zabrani oku najit zadni stenu.

#### Barva

- `near`: tmavy studeny ton
- `mid`: lehce ocelove-cyanovy haze
- `far`: utlumeny popelavy ton s jemnym teplym nadechem

Barevny drift ma byt podprahovy, ne dekorativni.

### D. Spatial Layout

#### Hierarchie

- nejblizsi vrstvy drzi citelnejsi obrys,
- vzdalenosti se postupne rozpadaji do mlhy a smeroveho svetla,
- zadna vrstva nesmi pusobit jako finalni konec chamber.

#### Symetrie

- kompozice ma byt jen castecne vyvazena,
- ne dokonale zrcadlova,
- monumentalni, ale ne sterilni.

### E. Komponentní rozpad

Pro `starCoreInteriorScene3d.jsx` z tohoto bloku vzniknou:

1. `RearDepthField`
2. `DepthMembraneLayer`
3. `DirectionalMemoryLight`
4. `DepthFogTuning`

#### `RearDepthField`

- orchestruje cele pole,
- sklada depth vrstvy a svetelne proudy.

#### `DepthMembraneLayer`

- jedna hloubkova vrstva,
- input:
  - `position`
  - `rotation`
  - `scale`
  - `opacity`
  - `warpBias`

#### `DirectionalMemoryLight`

- jeden svetelny smerovy signal,
- input:
  - `position`
  - `rotation`
  - `length`
  - `intensity`
  - `fragmentation`

#### `DepthFogTuning`

- nastavuje fog chovani a depth band logiku.

### F. Motion Rules

Povoleno:

- velmi pomaly drift hloubkovych vrstev,
- jemna zmena opacity memory beams,
- minimalni zmena perception pres pohyb kamery.

Zakazano:

- pulzujici zadni stena,
- silna noise animace,
- particle show,
- efektni pohyb, ktery se dere do popredi.

### G. Acceptance Criteria

1. Oko nenajde jasnou zadni zed.
2. Prostor pusobi hlubsi, nez realne je.
3. Svetlo pusobi smerove, ne dekorativne.
4. Fog pomaha cist vzdalenost.
5. I bez dalsi geometrie je scena citit jako prostor, ne placka.
6. Nic v tomto bloku nevytvari novy stredovy objekt.

### H. Implementační pořadí

1. zavest `RearDepthField` group,
2. pridat 3 zakladni `DepthMembraneLayer`,
3. pridat 2-3 `DirectionalMemoryLight` proudy,
4. doladit fog bandy,
5. pridat 1-2 dalsi vzdalene vrstvy pro rozpad konce prostoru,
6. overit, ze scena stale nema citelny `back wall`,
7. teprve potom prejit na dalsi subblok.

### 1A Correction Pass

Status: approved correction

Purpose:

- zjednodusit prvni pass `Rear Depth Field`,
- odstranit falesny stred,
- prestat vrstvit moc prvku driv, nez je citelny zaklad.

#### Correction rules

1. `kill the center`

- svetelne teziste nesmi sedet uprostred,
- stred ma byt vizualne nudny,
- gradient nebo tonovy akcent musi byt mimo stred nebo rozbity.

2. `one real depth layer first`

- v prvnim opravnem passu se nepouzije 4-5 membran,
- pouzije se jen 1 velka depth membrane,
- musi byt:
  - vzadu,
  - mimo osu,
  - lehce sikmo,
  - odlisena od backgroundu.

3. `introduce breakage`

- vrstva nesmi byt hladka a cista,
- musi obsahovat:
  - pruhy,
  - preruseni,
  - lehke zlomy,
  - nebo jemne noise naruseni opacity/silhouette.

4. `introduce direction`

- scena nesmi byt mrtva,
- musi dostat mikro-smer:
  - diagonalni drift,
  - nebo neparalelni orientaci vrstvy,
  - nebo lehkou smerovou zmenu svetla.

#### Temporary simplification

Dokud tenhle correction pass neni schvalen:

- nepřidavat dalsi depth vrstvy,
- nepřidavat dalsi memory beams,
- nepřidavat slozitejsi fog skladby.

#### Acceptance for correction pass

1. stred uz neni fokus,
2. jedna vrstva cte hloubku lepe nez predchozi multi-layer pokus,
3. scena uz neni hladka placka,
4. je citit jemny smer bez dramatickeho efektu.

### 1A Structural Correction

Status: approved structural correction

Purpose:

- opravit prilis jemny a prilis plochy `1A` pass,
- prejit z mikro-offsetu uvnitr jedne group na skutecnou hloubkovou separaci,
- docasne zvysit citelnost prostoru pro debug validaci.

#### Problem summary

Predchozi `BrokenDepthMembrane` pass byl stale:

- prilis sevreny do jedne group,
- prilis mikrovrstveny,
- prilis jemny v opacity,
- stale opticky organizovany kolem stredu.

#### New structural rule

`BrokenDepthMembrane` se rusi jako hlavni nosic `1A`.

Nahrazuje ji:

- `DepthLayerNearRear`
- `DepthLayerMidRear`
- `DepthLayerFarRear`
- `DepthLayerTerminal`

Kazda vrstva musi byt:

- samostatna group,
- na vlastni z hloubce,
- s vlastni deformaci,
- s vlastni opacity range,
- s vlastni orientaci.

#### Doporučené rozložení

`DepthLayerNearRear`

- `z = -12.5`
- nejcitelnejsi,
- vetsi plochy,
- lehce vyosena vlevo.

`DepthLayerMidRear`

- `z = -16`
- rozbitejsi segmenty,
- mensi celistvost,
- sikmy drift.

`DepthLayerFarRear`

- `z = -21`
- jen fragmenty a naznaky,
- nizsi opacity,
- vice rozpadle.

`DepthLayerTerminal`

- `z = -27`
- skoro ne objekt,
- jen interference a slabe plochy,
- ma rusit konec prostoru.

#### Debug opacity rule

V tehle fazi je povolena zamerne vyssi citelnost:

- hlavni membrany `0.12 az 0.18`
- sekundarni segmenty `0.06 az 0.10`
- stripe/light akcenty `0.05 az 0.08`

Jemneni az po overeni prostorove citelnosti.

#### Camera debug rule

Dokud se overuje `1A structural correction`:

- vypnout jemny drift kamery,
- drzet fixni look target,
- nechat prostor cist staticky.

Motion se vraci az po schvaleni staticke hloubky.

#### Light rule

`Directional memory light` v tehle fazi nema byt point light dekorace.
Ma byt vystaven jako:

- nekolik slabých elongated light planes,
- v ruznych `z`,
- s ruznou delkou,
- sikmo pres hloubkove vrstvy.

#### Fog rule

Globalni jeden fog wash nestaci.
`1A structural correction` ma zavest:

- `separation fog`
- `compression fog`
- `terminal dissolve`

Nemusi to byt nutne tri ruzne Three fog objekty.
Muze to byt kombinace:

- hlavni fog,
- fog planes,
- terminal haze layers.

#### Acceptance for structural correction

1. depth field je tvoren ctyrmi realne oddelenymi vrstvami,
2. oko cte hloubku mezi vrstvami, ne jen uvnitr jedne desky,
3. stred uz neni organizacni osa sceny,
4. debug verze je citelna i bez dalsi geometrie,
5. terminal vrstva rusi konec prostoru.

## 1B: Foreground Frame Blueprint

Status: approved blueprint

Purpose:

- dat kamere pocit, ze je uvnitr chamber,
- pridat foreground occlusion, parallax a meritko,
- udelat to bez noveho stredu, bez portalu a bez UI feelingu.

### Cíl

Foreground neslouzi jako objekt.
Foreground slouzi jako dukaz, ze kamera je uvnitr struktury.

### 1B NESMÍ

- vytvorit novy stred,
- pridat aktivni objekt,
- zavrit scenu jako mistnost,
- vytvorit symetricky ram,
- krast pozornost `1A`,
- pusobit jako UI overlay nebo portal.

### 1B MUSÍ

- pridat occlusion,
- pridat parallax,
- dat meritko,
- ramovat scenu bez centrovani,
- vytvorit pocit pruchodu skrz strukturu.

### Typy prvků

#### 1. Near braces

- 2 az 3 velke blizke prvky,
- jeden vlevo,
- jeden vpravo,
- jeden volitelne nahore,
- musi byt castecne oriznute viewportem,
- nesmi byt symetricke,
- nesmi tvorit uzavreny ram.

#### 2. Hanging rails

- delsi tenke prvky,
- nesmi byt dokonale vertikalni,
- lehce sikme nebo zkroucene,
- musi pusobit jako konstrukce, ne jako UI sloup.

#### 3. Broken frame fragments

- kratke zlomene kusy,
- jen naznak architektury,
- zadny kompletni portal,
- zadna uzavrena forma.

### Prostorová pravidla

- `z` rozsah orientacne `-2 az -6`,
- foreground musi byt bliz nez vsechny vrstvy `1A`,
- prvky nesmi byt v jedne rovine,
- nesmi vzniknout symetrie,
- stred viewportu musi zustat pruchozi.

### Occlusion pravidla

- alespon 2 prvky musi castecne prekryvat `1A`,
- prekryti musi byt mimo stred,
- foreground nesmi nikdy kompletne odkrit cely viewport,
- alespon jeden prvek musi byt castecne mimo obraz,
- occlusion musi byt jemna, ne dominantni.

### Edge princip

Foreground neni plocha.
Foreground je hrana, ktera reze prostor.

Preferovat:

- tenke,
- ostre,
- useknute tvary.

Vyhybat se:

- velkym plnym panelum,
- kompaktnim deskam,
- tvarum ctenym jako stena.

### Vizuální jazyk

- tmavsi nez `1A`,
- nizsi opacity nez by bylo intuitivni,
- spis silueta nez vyplnena plocha,
- zadny dekorativni efekt.

Implementacni nuance:

- hrana ma byt opticky kontrastnejsi nez vypln,
- foreground ma pusobit jako rez struktury, ne jako translucent panel.

### Motion

- temer staticke,
- pripadne velmi jemny drift,
- zadny vyrazny pohyb.

### Definition of Done

1. kamera je citit uvnitr prostoru,
2. foreground a `1A` jsou jasne oddelene,
3. existuje parallax rozdil,
4. stred neni zakryty ani magneticky,
5. nevznika zadny hero object,
6. scena nepusobi jako portal ani UI frame.
