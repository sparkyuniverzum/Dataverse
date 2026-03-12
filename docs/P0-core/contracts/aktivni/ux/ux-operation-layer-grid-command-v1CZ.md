# UX operation layer: grid + command bar v1

Stav: aktivni (release-grade operation kontrakt)
Datum: 2026-03-12
Vlastnik: FE architektura + Runtime parser/executor

## 1. Ucel

Definovat operation vrstvu tak, aby:

1. Grid byl inovativni, ale porad nejrychlejsi pro praci,
2. Command Bar byl vykonny, naucitelny a bezpecny,
3. parser slib odpovidal realnym BE schopnostem.

## 2. Realna schopnost BE parseru (source of truth)

## 2.1 Parser v2 intents (kanonicka vrstva)

Backend parser v2 umi:

1. `UPSERT_NODE`
2. `ASSIGN_ATTRIBUTE`
3. `CREATE_LINK`
4. `FLOW`
5. `EXTINGUISH_NODE`
6. `SELECT_NODES`
7. `SET_FORMULA`
8. `ADD_GUARDIAN`
9. `BULK` (obal nad vyse uvedenymi)

## 2.2 Bridge na executor actions

Parser v2 se v bridge mapuje na:

1. `INGEST`
2. `UPDATE_CIVILIZATION`
3. `LINK`
4. `DELETE` nebo `EXTINGUISH`
5. `SELECT`
6. `SET_FORMULA`
7. `ADD_GUARDIAN`

## 2.3 Legacy parser (v1 fallback)

Pri policy fallbacku umi i textove vzory:

1. `zhasni|smaz|delete: <target>`
2. `hlidej: <target>.<field> <op> <threshold> -> <action>`
3. `spocitej: <target>.<field> = SUM|AVG|MIN|MAX|COUNT(<source_attr>)`
4. `ukaz|najdi|show|find: <target> @ <condition?>`
5. `spoj: A, B` nebo relacni vyrazy s `+`, `:`, `->`

Poznamka:
`DATAVERSE_PARSER_V2_FALLBACK_POLICY` urcuje, kdy fallback v1 smi bezet.

## 2.4 Co parser aktualne NEumi

1. Volny "chat" prikaz bez syntakticke kostry a bez resolveru.
2. Smisene link selektory `NAME` + `ID` v jednom `CREATE_LINK`.
3. `ASSIGN_ATTRIBUTE expected_event_seq` nad `NAME` selektorem.
4. "Hadej co jsem myslel" mutace bez explicitniho targetu.

Pravidlo:
Command Bar nesmi slibovat funkce mimo body 2.1-2.3.

## 3. Grid kontrakt (inovativni + efektivni)

## 3.1 Primarni role

1. Grid je canonical row/mineral editor.
2. Scena je kontext a feedback, ne primarni data editor.
3. Kazdy kriticky write flow musi jit dokoncit ciste pres grid.

## 3.2 Inovace bez ztraty rychlosti

1. Inline typed validace pri editaci.
2. Multi-row akce s preview (`draft -> preview -> commit`).
3. Kontekstove action chips podle vybrane entity.
4. Visible repair lane pro konflikty (`OCC`, validace, scope mismatch).

## 3.3 Hard productivity pravidla

1. Bez povinneho prepnuti do cinematic modu pri opakovane editaci.
2. Bez modal locku pres celou workspace pro bezne row operace.
3. Bez skryvani commit controls pod "efekty".

## 4. Command Bar kontrakt

## 4.1 Tri vstupni rezimy

1. `Guided`:
   - klikatelne command chips (bez psani),
2. `Slash`:
   - strukturovane prikazy s napovedou syntaxe,
3. `Intent text`:
   - parser text pro power usere (v2 + policy fallback v1).

## 4.2 Doporucena command gramatika ve FE

1. FE ukazuje kanonicke prikazy:
   - `/vytvor civilizaci <nazev>`
   - `/nastav <cil>.<pole> na <hodnota>`
   - `/propoj <zdroj> s <cil> jako <typ>`
   - `/zhasni <cil>`
   - `/vyber <cil> kde <podminka>`
   - `/vzorec <cil>.<pole> = SUM(<attr>)`
   - `/strazce <cil>.<pole> >= <prahovka> -> <akce>`
2. Pred odeslanim FE prikaz prevede na parser payload (`/parser/plan` nebo `/parser/execute`).
3. FE nesmi posilat nevalidni "zkratky" bez parser planu.

## 4.3 Explainability pred commitem

1. Kazdy command ma `Plan preview`:
   - parser verze (`v2` / fallback),
   - seznam vzniklych atomic tasku,
   - scope (`galaxy_id`, `branch_id`),
   - rizikove body (destruktivni nebo multi-step akce).
2. Teprve po potvrzeni jde command do execute.
3. Parse/bridge chyba musi byt prelozena do lidskeho vysvetleni + next step.

## 4.4 Safety railings

1. Scope lock badge je viditelny pri kazdem commandu.
2. Mutace s OCC ocekavanim musi zobrazit `expected vs current`.
3. Idempotency-safe opakovani musi mit explicitni `retry`.
4. Command history je auditovatelna a filtrovatelna.

## 5. Minimap + command synergie

1. Minimap muze navrhnout "mise" nebo "anomaly", ale command bar musi umet prime otevreni.
2. Kazdy minimap signal ma odpovidajici explicitni command CTA.
3. Uzivatel nikdy nemusi "lovit" lokaci bez alternativy v command baru.

## 6. Hard release gate

1. Parser fidelity:
   - FE command docs odpovidaji realnym parser schopnostem.
2. Determinism:
   - stejny command + stejny scope = stejny parser plan.
3. Explainability:
   - parse fail, bridge fail i execution fail maji jasny dalsi krok.
4. Productivity:
   - bezny row edit je rychlejsi nebo stejny jako baseline grid flow.
5. Safety:
   - zadny command neobejde canonical API pravidla.

Poruseni kterehokoli bodu 1-5 = hard-stop, release blokovan.

## 7. Dukazni sada (povinna)

1. `technical completion`:
   - focused testy parser contractu, command preview, scope/OCC handling.
2. `user-visible completion`:
   - before/after command bar demo scenare:
     - create,
     - mutate,
     - link,
     - extinguish,
     - formula,
     - guardian.
3. `documentation completion`:
   - update onboarding + journey + risk map.
4. `gate completion`:
   - bundled smoke gate po operation-layer slice serii.

## 8. Co se nepocita jako completion

1. Prompt input bez parser plan preview.
2. "AI magic" odpoved bez deterministickeho task planu.
3. Grid kosmetika bez realne rychlosti/bezpecnosti workflow.
4. Command syntax, ktera vypada pekne, ale backend ji realne neumi.

## 9. Navazne kontrakty

1. `docs/P0-core/contracts/aktivni/fe/command-lexicon-cz-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/parser-alias-learning-and-event-preview-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/ux/ux-onboarding-story-missions-v1CZ.md`
