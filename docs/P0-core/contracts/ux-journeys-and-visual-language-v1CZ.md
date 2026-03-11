# UX journey a visual language v1

Status: active (UX journey baseline)
Date: 2026-03-11
Owner: Product UX + FE design system

## 1. Ucel

Definovat kriticke user journey a visual language tak, aby Dataverse dorucil:

1. spickovy prostorovy zazitek (`wow`),
2. operator-level rychlost a srozumitelnost,
3. deterministickou feedback smycku a duveru.

## 2. Experience strategie

Dataverse pouziva:

1. cinematic kontext pro orientaci a emocionalni dopad,
2. takticke HUD pro prubezny stav,
3. vysokorychlostni operacni grid pro opakovanou datovou praci.

Pravidlo:
`Cinematic shell + operational core`.

## 3. Kriticke journey (MVP)

## 3.1 J1 - Nulty kontakt (Nexus) a vyber galaxie

Cil:
Operator vstoupi do systemu a vyresi workspace scope.

Flow:

1. `Nexus` obrazovka ukaze centralni 3D anchor model.
2. HUD vypise dostupne galaxie a primarni CTA `Initialize new Galaxy`.
3. Operator vybere nebo zalozi galaxii.

Success criteria:

1. galaxy scope je explicitni pred vstupem do workspace,
2. nevznika dvojznacny “global” stav.

## 3.2 J2 - Seamless transition do workspace

Cil:
Odstranit generic loading break a zachovat pohlceni.

Flow:

1. akce spusti camera fly-through transition do zvolene galaxie,
2. transition konci na takticke mrizce a workspace shellu,
3. onboarding stav je viditelny (`onboarding_incomplete` nebo `onboarding_ready`).

Success criteria:

1. transition lze preskocit,
2. operacni ovladani je dostupne ihned po transition.

## 3.3 J3 - Zrozeni hvezdy a policy lock

Cil:
Uzivatel pochopi governance gate pred stavbou planet.

Flow:

1. hvezda se objevi a stabilizuje ve stredu workspace,
2. Star Core prstenec zobrazi klicove stavy,
3. uzivatel provede `Lock Policy`,
4. stav prejde z `UNLOCKED` na `LOCKED/POLICY_READY`.

Success criteria:

1. policy lock je explicitni a vratny jen pres povoleny governance flow,
2. onboarding progression se viditelne aktualizuje.

## 3.4 J4 - Star Core dive a governance operace

Cil:
Control-plane akce musi pusobit high-value, ale zustat deterministicke.

Flow:

1. uzivatel vstoupi do Star Core (dive transition),
2. governance/physics ovladani se upravi a potvrdi,
3. pulse/metrics zobrazi vysledny stav,
4. uzivatel se vrati zpet do workspace kontextu.

Success criteria:

1. nedochazi ke ztrate predchoziho workspace vyberu,
2. governance akce jsou auditovatelne a jasne oddelene od row CRUD.

## 3.5 J5 - Umisteni planety a inicializace struktury

Cil:
Operator vytvori datovy kontejner s jednoznacnym empty stavem.

Flow:

1. uzivatel umisti planetu na orbitu,
2. planeta prejde z wireframe do aktivniho container shellu,
3. HUD zobrazi `POPULATION: 0` a pozadovanou dalsi akci.

Success criteria:

1. empty container stav je jednoznacny,
2. dalsi krok je jasne naveden.

## 3.6 J6 - Vytvoreni civilizace a editace mineralu

Cil:
Rychly kazdodenni datovy autoring.

Flow:

1. uzivatel vytvori civilization (row),
2. operation layer (grid/command) je primarni editacni surface,
3. scena reflektuje update v near-real-time,
4. mineral editace zobrazuje typed validation feedback.

Success criteria:

1. zadny blokujici cinematic pro opakovane editace,
2. invalid/blocked stavy vzdy obsahuji repair hint.

## 3.7 J7 - Pripojeni moon capability a propagace efektu

Cil:
Ukazat dopad capability bez zameni capability a row.

Flow:

1. uzivatel vstoupi do planet capability modu,
2. pripoji moon modul do capability slotu,
3. capability commit aplikuje efekt na row validation/formula behavior,
4. mineral ukazuje computed/locked stav s provenance.

Success criteria:

1. bez moon-as-row implikace,
2. capability impact je v UI traceovatelny.

## 3.8 J8 - Vytvoreni bond a bezpecne extinguish

Cil:
Udelat relace intuitivni a bezpecne.

Flow:

1. uzivatel propoji source a target civilization,
2. preview zobrazi validity a scope checky,
3. commit vytvori aktivni bond,
4. extinguish ukaze nedestruktivni ghost history stav.

Success criteria:

1. blocked link vraci presny duvod,
2. zadny hard-delete behavior ani beze stopy zmizejici vizual.

## 4. Visual language system

## 4.1 Render prostorove ontologie

1. Galaxy = atmosfera hranice workspace.
2. Star = governance centralni kotva.
3. Planet = strukturialni kontejnerova telesa na orbite.
4. Moon = capability moduly pripojene na planet contract ring.
5. Civilization = surface population uzly.
6. Bond = semanticke energeticke vazby mezi civilization uzly.

## 4.2 Material a hustota

1. Scena: volumetricka hloubka, stridmy glow, vysoky kontrast pro citelnost.
2. HUD: translucent glass, low-noise typografie, strucny operator copy.
3. Grid: cisty datove-husty layout s premium micro-motion, bez vizualniho sumu.

## 4.3 Motion pravidla

1. Motion vysvetluje zmenu stavu, rezimu nebo scope transition.
2. Idle animace nesmi rusit operation layer.
3. Opakovane operace pouzivaji minimalni motion.

## 4.4 Barvova semantika

1. Nominal/stable: chladne modre spektrum.
2. Warning/gate pending: amber.
3. Blocked/error: cervena s repair affordance.
4. Branch kontext: jemny tonalni posun + explicitni textovy badge.

## 5. Interaction gramatika (shape logic)

1. Planet capability ring exponuje moon-only sloty.
2. Civilization surface grid exponuje row population sloty.
3. Bond linking je pouze civilization-to-civilization.
4. Invalid drop target musi vratit jasnou vizualni i textovou odezvu.

## 6. UX quality gate (must pass)

1. Kazda kriticka akce ma immediate feedback do 200 ms.
2. Kazde selhani ma actionable dalsi krok.
3. Zadny journey krok nesmi zaviset na skrytych controls.
4. Reduce-motion mode drzi plnou funkcni paritu.
5. Operator musi dokoncit J5+J6 bez povinne dlouhe animace.

## 7. Anti-patterny (zakazane)

1. Cinematic transition pri kazde row editaci.
2. Full-screen nepruhledny modal pres operacni kontext u komplexnich review tasku.
3. Dvojznacne labely, ktere stiri moon capability vs civilization row.
4. Effects-first vizual, ktery skryje commit/repair controls.
