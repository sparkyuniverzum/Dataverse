# UX onboarding story mise v1

Stav: aktivni (release-grade onboarding kontrakt)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura

## 1. Ucel

Navrhnout onboarding jako kratkou, zapamatovatelnou misi, ktera:

1. doda wow efekt,
2. vysvetli ontologii bez nudneho tutorialu,
3. nezablokuje operator workflow.

Pravidlo:
Onboarding je vedena expedice, ne povinna hra pred praci.

## 2. Hard constraints

1. Core workflow zustava dostupny ihned (zadne zamcene kriticke funkce).
2. `Skip onboarding` je dostupne od prvni sekundy.
3. `Reduce motion` drzi plnou funkcni paritu.
4. Onboarding nesmi prepsat kanonickou ontologii:
   - `civilization` = row,
   - `moon` = capability.
5. Onboarding nesmi menit runtime pravidla, jen zpusob jejich vysvetleni.

## 3. Mise a flow

## 3.1 M0 - Letovy plan pilota

1. Registrace obsahuje `jmeno pilota` jako onboarding identitu.
2. UI text vysvetli, ze jde o personalizaci mise, ne herni profil.

## 3.2 M1 - Prilet do galaxie

1. Kratka cinematic sekvence (`Nexus -> Galaxy Workspace`).
2. Kamera konci v pozici, kde je videt hvezda a hlavni operation zona.
3. Scope badge (`MAIN`/`BRANCH`) musi byt citelny uz pri dosednuti.

## 3.3 M2 - Prvni kontakt se hvezdou

1. Uživatel vidi stav hvezdy (`UNLOCKED` -> `LOCKED`).
2. Mise vede k `Lock Policy` jako prvnimu governance kroku.
3. Po uzamceni je jasny dalsi krok (`najdi domovskou planetu`).

## 3.4 M3 - Domovska planeta

1. Uživatel umisti planetu do pripravenne orbity.
2. Stav planety je explicitne `POPULATION: 0`.
3. Mise prejde na osidleni.

## 3.5 M4 - Osidleni civilizaci

1. Uživatel vytvori prvni `civilization`.
2. Grid je primarni edit surface.
3. Scena jen potvrzuje vysledek (neni primarni editor).

## 3.6 M5 - Tezba mineralu

1. Uživatel provede prvni edit mineralu.
2. UI ukaze typed feedback a validacni stav.
3. Selhani musi mit `repair hint`.

## 3.7 M6 - Pruzkum mesice (capability)

1. Uživatel pripoji prvni `moon` capability k planete.
2. Uživatel vidi dopad capability na row behavior.
3. Vysvetleni explicitne rika: `Mesic (capability), ne radek`.

## 4. Minimap a postupne odhalovani

## 4.1 Minimap model

1. Minimap je orientacni vrstva, ne povinny navigator.
2. Zobrazuje:
   - aktualni sektor,
   - mission body,
   - signaly prilezitosti (`anomaly`).
3. Kriticke body mise jsou viditelne vzdy.

## 4.2 Curiosity loop (volitelny)

1. Vedle hlavni mise existuji volitelne objevy (`anomaly events`).
2. Objevy odemykaji:
   - zrychlene zkratky,
   - operator helpery,
   - kosmeticke/feedback bonusy.
3. Objevy nikdy neukryvaji core funkce.

## 4.3 Hint ladder

1. Uroven 1: teaser (`Byl detekovan signal`).
2. Uroven 2: minimap sektor.
3. Uroven 3: presna CTA navigace.

Pravidlo:
Pokud je feature kriticka pro praci, uroven 3 musi byt dostupna okamzite.

## 5. Casove a UX limity

1. Full onboarding cesty: cil 4-6 minut.
2. Povinna cast onboardingu: max 3 minuty.
3. Time-to-first-edit (od vstupu do workspace po prvni row edit): p95 <= 4.5 s.
4. Zadny krok nesmi byt dead-end bez navratu nebo skip.

## 6. Hard release gate

1. Kazda mise ma:
   - jasny cil,
   - jasny success signal,
   - jasny dalsi krok.
2. Onboarding neblokuje core operace po skipu.
3. V prvnich 30 s je jasny scope, mode a dalsi akce.
4. Minimap neukryva kriticke workflow body.
5. Curiosity vrstva je volitelna a vypnutelna.

Poruseni kterehokoli bodu 1-5 = hard-stop, release blokovan.

## 7. Dukazni sada (povinna)

1. `technical completion`:
   - focused testy pro onboarding state machine, skip/reduce-motion parity, minimap signal mapping.
2. `user-visible completion`:
   - before/after screenshoty M0-M6,
   - seznam viditelnych zmen v prvnich 30 s.
3. `documentation completion`:
   - update journey + IA + risk dokumentu.
4. `gate completion`:
   - bundled staging smoke po onboarding slice serii.

## 8. Co se nepocita jako completion

1. Dlouha cinematic show bez rychleho vstupu do operacni zony.
2. Schovavani kritickych funkci jako hra na hledani.
3. Onboarding, ktery vypada dobre, ale nepripravi uzivatele na realny grid workflow.
4. Rychly test pass bez user-visible zlepseni prvniho dojmu.

## 9. Vazba na command vrstvu

1. Onboarding texty a mise musi pouzivat stejnou slovni zasobu jako `Grid + Command Bar`.
2. Onboarding nesmi slibovat prikazy, ktere parser backend realne nepodporuje.
3. Zdroj pravdy pro prikazy a syntax je dokument:
   - `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`
   - `docs/P0-core/contracts/aktivni/fe/command-lexicon-cz-v1CZ.md`
   - `docs/P0-core/contracts/aktivni/fe/parser-alias-learning-and-event-preview-v1CZ.md`
