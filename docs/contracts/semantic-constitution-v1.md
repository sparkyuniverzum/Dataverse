# DataVerse Semantic Constitution v1

Status: normative
Date: 2026-03-02

Tento dokument sjednocuje doménový jazyk mezi parserem, API, event-store, read-modely a UI.

## I. Ontologický slovník (podstatná jména)

| Core term | Vizuální termín | Význam |
|---|---|---|
| Galaxy | Galaxie (Sovereignty) | Nejvyšší tenant kontejner a bezpečnostní hranice. |
| Constellation | Souhvězdí (Context) | Tematický kontext/oblast (např. HR, Vývoj). |
| Planet | Planeta (Contract) | Typová a validační definice tabulky (`table_id`, table contract). |
| Moon | Měsíc (Capability) | Rozšiřující schopnost planety (dictionary/validation/formula/bridge). |
| Civilization | Civilizace (Instance) | Konkrétní datový bod/řádek na planetě (runtime row). |
| Mineral | Nerost (Attribute) | Atribut (field) a jeho hodnota uvnitř civilizace. |
| Bond | Vazba | Relace mezi civilizacemi (`RELATION`, `TYPE`, ...). |
| Chronicle | Kronika | Neměnný event log (event store). |
| Branch | Větev (staging scénář) | Izolovaná časová větev nad main timeline. |

## II. Sémantická gramatika (slovesa/operátory)

### `:` Příslušnost / definice
- Význam: "patří do třídy / typu".
- Canonical shape: `Civilization : Planet`.
- Efekt: `INGEST(left)`, `INGEST(right)`, `LINK(type="TYPE")`.

### `+` Relace / propojení
- Význam: "má vztah k / spolupracuje s".
- Canonical shape: `CivilizationA + CivilizationB [+ CivilizationC ...]`.
- Efekt: `INGEST` pro operand(y) + sekvenční `LINK(type="RELATION")`.
- Zákon: `RELATION` je nedirektivní (`A+B == B+A`).

### `->` Tok / akce
- Význam: "směřuje k akci/reakci".
- V1: používá se v guardian syntaxi (`Hlídej ... -> action`).
- Pravidlo proti kolizi: `->` se nepoužívá pro přímý zápis atributu.

### `:=` (nebo `=`) Hodnota atributu
- Význam: "nastav atribut/hodnotu".
- Doporučený tvar Parser 2.0: `Civilization.field := value`.
- Důvod: zabrání nejednoznačnosti s `->`.

### `-` Zhasnutí (extinguish)
- Význam: "už není aktivně relevantní".
- Efekt: výhradně soft-delete (`deleted_at`, tombstone eventy), nikdy hard delete.

## III. Železná pravidla systému (zákony)

1. Zákon zachování informace
Nic zapsaného do Kroniky nesmí být hard-delete.

2. Zákon kauzality
Každý stav instance musí být vysvětlitelný řetězcem událostí.

3. Zákon dimenze
Grid a 3D reprezentují stejný stav; nesmí vzniknout informační drift.

4. Zákon identity
Identita instance (`id`) je neměnná napříč událostmi.

5. Zákon projekce
Read-model je deterministická projekce event logu, ne alternativní source of truth.

6. Zákon větví
Branch je izolovaná timeline; `promote` je replay branch eventů do main.

7. Zákon kontraktu
Když pro tabulku existuje contract, každý efektivní write ho musí validovat před appendem eventu.

## IV. Normalizační pravidla

- Branch názvy jsou unikátní v rámci galaxie po normalizaci `trim + casefold`.
- `RELATION` vazby se canonicalizují jako neuspořádaný pár.
- Všechny write operace respektují tenant hranici `user_id + galaxy_id`.

## V. Implementační závazky po vrstvách

- Parser: nesmí generovat nejednoznačnou syntaxi; při konfliktu vrací diagnostickou chybu.
- API: vrací deterministické statusy (`422`, `403`, `404`, `409`) podle porušení zákonů.
- Executor: validuje kontrakty a appenduje pouze kauzálně platné eventy.
- Projection/UI: prezentuje stav bez driftu vůči event-store.

## VI. Kompatibilita V1

- Stabilní v V1:
- `+`, `:`, `DELETE/EXTINGUISH`, `SET_FORMULA`, `ADD_GUARDIAN`.
- `RELATION` canonical semantics.
- Branch izolace + promote replay.
- Přechodový runtime alias:
  - současné řádkové endpointy `/moons*` jsou kompatibilitní surface pro civilization lifecycle,
  - kanonický cíl je oddělení: `Moon capability != Civilization row`.

- Vyhrazené pro Parser 2.0:
- Přímý atributový zápis přes `:=` (nebo ekvivalent).
- Rozšířený tokový jazyk nad `->` mimo guardian pravidla.
