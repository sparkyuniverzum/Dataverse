# Command lexikon CZ v1

Stav: aktivni (kanonicky slovnik povelu)
Datum: 2026-03-12
Vlastnik: FE command UX + Runtime parser/executor

## 1. Ucel

Zavest jeden oficialni CZ slovnik pro `Grid + Command Bar`, aby:

1. prikazy byly naucitelne pro ceske publikum,
2. FE napoveda a BE parser mluvily stejnym jazykem,
3. nevznikaly nejednoznacne "chatove" mutace.

## 2. Principy slovniku

1. Jedna kanonicka forma prikazu.
2. Rizene aliasy jsou povolene, ale neprepisuji kanonicky vyznam.
3. Kazdy prikaz musi jit prelozit na parser intent + atomic task plan.
4. Kriticke mutace musi mit preview pred commitem.

## 3. Kanonicke povely DVC-CZ

## 3.1 Row a mineral operace

1. `vytvor civilizaci <nazev>`
   - intent: `UPSERT_NODE`
   - bridge: `INGEST`
2. `nastav <cil>.<pole> na <hodnota>`
   - intent: `ASSIGN_ATTRIBUTE`
   - bridge: `UPDATE_CIVILIZATION` nebo `INGEST` (dle selectoru)
3. `zhasni <cil>`
   - intent: `EXTINGUISH_NODE`
   - bridge: `DELETE` nebo `EXTINGUISH`
4. `vyber <cil> kde <podminka>`
   - intent: `SELECT_NODES`
   - bridge: `SELECT`

## 3.2 Vazby, vzorce, strazce

1. `propoj <zdroj> s <cil> jako <typ>`
   - intent: `CREATE_LINK`
   - bridge: `LINK`
2. `tok <zdroj> -> <cil>`
   - intent: `FLOW`
   - bridge: `LINK` (`type=FLOW`)
3. `vzorec <cil>.<pole> = <funkce>(<zdroj>)`
   - intent: `SET_FORMULA`
   - bridge: `SET_FORMULA`
4. `strazce <cil>.<pole> <op> <prahovka> -> <akce>`
   - intent: `ADD_GUARDIAN`
   - bridge: `ADD_GUARDIAN`

## 3.3 Davkove povely

1. `davka { <prikaz_1>; <prikaz_2>; ... }`
   - intent: `BULK`
   - bridge: sekvence tasku dle vnitrnich prikazu

## 4. Povinna terminologie v prikazech

1. `civilizace` je row runtime entita.
2. `mesic` je capability nad planet/table kontraktem.
3. `mesic` se nesmi pouzivat jako synonymum pro row.
4. `asteroid*` terminologie je zakazana.

## 5. Rizene aliasy

1. Alias muze zkratit prikaz, ale nesmi zmenit semantiku.
2. Alias nesmi kolidovat s rezervovanymi kanonickymi slovy.
3. Alias nesmi prepsat ontologii (`mesic` != row).
4. Kazdy alias ma vlastnika scope a audit stopu.

## 6. Parser vazba

1. Preferovany parser mod je `v2`.
2. Fallback `v1` se ridi `DATAVERSE_PARSER_V2_FALLBACK_POLICY`.
3. Lexikon nesmi inzerovat prikaz, ktery parser/bridge realne neumi.
4. FE napoveda bere data z jednoho source-of-truth kontraktu + runtime lexicon endpointu.

## 7. Hard release gate

1. Kazdy povel ze sekce 3 ma:
   - validni parser plan,
   - validni bridge mapovani.
2. Neznamy povel vraci:
   - jasnou chybu,
   - navrh nejblizsich povelu.
3. Prikaz s mutaci bez preview je zakazany.
4. Poruseni bodu 1-3 = hard-stop, release blokovan.

## 8. Dukazni sada

1. `technical completion`:
   - parser/bridge contract testy pro vsechny kanonicke povely.
2. `user-visible completion`:
   - command help panel zobrazuje presne tento slovnik.
3. `documentation completion`:
   - soulad s onboarding a operation layer kontrakty.
4. `gate completion`:
   - bundled smoke gate po command-system slice serii.

## 9. Co se nepocita jako completion

1. Volny prompt bez kanonicke gramatiky.
2. Alias, ktery meni vyznam prikazu.
3. Dokumentace povelu bez runtime parser parity.
