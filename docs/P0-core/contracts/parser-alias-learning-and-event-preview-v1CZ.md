# Parser alias learning a event preview explainability v1

Stav: aktivni (specifikace pro command inteligenci)
Datum: 2026-03-12
Vlastnik: Runtime parser + FE command UX + Event sourcing governance

## 1. Ucel

Doplnit command system o:

1. uzivatelske aliasy povelu,
2. preview "co se stane a proc" pred commitem,
3. auditovatelne a deterministicke chovani.

## 2. Alias learning kontrakt

## 2.1 Scope aliasu

1. `personal`:
   - plati pro `user_id + galaxy_id`.
2. `workspace`:
   - sdilene v ramci `galaxy_id` (governance role required).

Poznamka:
Branch-level aliasy jsou zakazane (omezit chaos a drift).

## 2.2 Alias entity

Pole:

1. `alias_id`
2. `scope_type` (`personal|workspace`)
3. `galaxy_id`
4. `owner_user_id` (pro personal)
5. `alias_phrase`
6. `canonical_command`
7. `is_active`
8. `created_at`
9. `updated_at`
10. `version`

## 2.3 Resoluce aliasu

Poradi:

1. personal alias,
2. workspace alias,
3. kanonicky prikaz z lexikonu.

## 2.4 Konfliktni pravidla

1. Zakaz prepsat rezervovana kanonicka slova.
2. Zakaz aliasu meniciho ontologii (`mesic` jako row).
3. Zakaz dvou aktivnich aliasu se stejnou frazi v jednom scope.
4. Pri konfliktu vracet structured conflict detail.

## 3. Event preview explainability kontrakt

## 3.1 Povinny preview pipeline

1. `compose`:
   - uzivatel zada prikaz nebo alias.
2. `resolve`:
   - system prevede alias na kanonicky prikaz.
3. `plan`:
   - parser/bridge vytvori intent + atomic task plan.
4. `explain`:
   - system ukaze expected events, rizika a "because chain".
5. `commit`:
   - az po explicitnim potvrzeni.

## 3.2 Preview payload (navrh)

1. `resolved_command`
2. `parser_version`
3. `fallback_used` + `fallback_reason`
4. `intents`
5. `atomic_tasks`
6. `expected_events` (predikovane event typy)
7. `semantic_effects_expected` (code + because)
   - po polozkach mutacniho planu (`task_index`, `action`, `code`, `event_types`),
   - povinne `because_chain` (lidske vysvetleni proc se mutace stane),
   - pro nemutacni akce je tento blok volitelny.
8. `scope` (`galaxy_id`, `branch_id`)
9. `risk_flags` (destructive, multi-step, scope-sensitive)
10. `next_step_hint`
11. `occ_signals`
   - seznam OCC dopadovych signalu na entitach,
   - kazdy signal obsahuje minimalne `action`, `expected_event_seq`, `current_event_seq`, `known`, `because`.

## 3.3 Explainability pravidla

1. Kazda mutace musi mit lidske "proc" vysvetleni.
   - vysvetleni je reprezentovane jako `because_chain` navazane na konkretni mutacni task.
2. OCC riziko musi ukazat:
   - `expected_event_seq`,
   - `current_event_seq` (pokud je zname).
   - pokud neni target jednoznacny, `known=false` + duvod v `because`.
3. Scope riziko musi ukazat:
   - aktivni branch/main,
   - potencialni dopad.
4. Destruktivni akce musi mit explicitni varovani + potvrzeni.

## 4. API kontrakt (navrhovany)

## 4.1 Lexikon

1. `GET /parser/lexicon`
   - vraci kanonicke CZ povely + rezervovana slova + parser support matrix.

## 4.2 Aliasy

1. `GET /parser/aliases`
2. `PUT /parser/aliases`
3. `PATCH /parser/aliases/{alias_id}`
4. `DELETE /parser/aliases/{alias_id}`

## 4.3 Preview

1. `POST /parser/preview`
   - bez zapisu eventu,
   - vraci data dle sekce 3.2.
2. `POST /parser/execute`
   - povoleno az po validnim preview.

## 5. Event sourcing vazba

1. Alias operace jsou eventovane:
   - `ALIAS_REGISTERED`,
   - `ALIAS_UPDATED`,
   - `ALIAS_DEPRECATED`.
2. Preview response obsahuje odhad zapisovanych domenovych eventu.
3. Execute response vraci skutecne zapsane eventy + semantic effect chain.

## 6. Hard release gate

1. Determinism:
   - stejny vstup + scope + alias verze = stejny plan.
2. Explainability:
   - zadna mutace bez preview a because chain.
3. Safety:
   - alias nesmi obchazet canonical API pravidla.
4. Audit:
   - kazda alias zmena ma audit stopu a ownera.
5. Poruseni bodu 1-4 = hard-stop, release blokovan.

## 7. Dukazni sada

1. `technical completion`:
   - unit/integration testy pro alias resolve, conflict detect, preview payload.
2. `user-visible completion`:
   - command preview panel ukazuje "co se stane a proc".
3. `documentation completion`:
   - update lexikonu, onboarding a operation kontraktu.
4. `gate completion`:
   - bundled smoke gate po command intelligence slicich.

## 8. Co se nepocita jako completion

1. Aliasy bez conflict guardu.
2. Preview bez expected events nebo bez because chain.
3. Execute bez predchoziho preview kroku.
4. "Smart alias", ktery neni auditovatelny.
