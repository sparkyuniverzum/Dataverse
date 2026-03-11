# Backend MVP požadavky z Canonical UX Ontology v1

Status: active (backend MVP extraction baseline)
Datum: 2026-03-11
Vlastník: Core BE architecture

## 1. Co se změnilo

- [x] 2026-03-11 Přidán jednotný backend MVP baseline extrahovaný z `canonical-ux-ontology-v1.md`.
- [x] 2026-03-11 Ontologické definice převedeny na implementační omezení pro API, datový model, lifecycle a runtime guardy.
- [x] 2026-03-11 Přidán closure checklist pro BE hardening scope.

## 2. Proč se to změnilo

Potřebujeme jeden explicitní BE MVP kontrakt, který:

1. převádí ontologii do vykonatelného backend scope,
2. odstraňuje nejednoznačnost capability vs row,
3. zamyká kanonické namespace a mutation constraints před dalšími implementačními bloky.

## 3. Zdroj a evidence

Zdroj ontologie:

- `docs/P0-core/contracts/canonical-ux-ontology-v1.md`
- použité sekce: Domain truth, Runtime truth, Entity ontology, Interaction ontology.

Evidence command set:

```bash
sed -n '1,260p' docs/P0-core/contracts/canonical-ux-ontology-v1.md
sed -n '260,560p' docs/P0-core/contracts/canonical-ux-ontology-v1.md
sed -n '560,920p' docs/P0-core/contracts/canonical-ux-ontology-v1.md
```

## 4. Kanonická globální BE MVP pravidla

1. Kanonický row runtime namespace je pouze `/civilizations*`.
2. Moon je capability doména planety, není row doména.
3. `/moons*` se nesmí zavádět jako kanonický row CRUD surface.
4. `/asteroids*` je zakázaný runtime/API surface.
5. Extinguish/delete semantika pro row a bond lifecycle je pouze soft-delete.
6. Runtime scope se vždy řeší jako `user_id + galaxy_id (+ optional branch_id)`.
7. Planet contract write a civilization row write jsou oddělené domény.
8. OCC + idempotency jsou povinné pro mutující flow.
9. Parser vstup je intent-level, exekuce je atomic-task level s deterministickou validační bránou.

## 5. Entity-level BE MVP požadavky

## 5.1 Galaxy (tenant/workspace hranice)

Backend vlastní:

- identitu workspace scope,
- stav onboarding záznamu,
- mapování aktivního vesmíru větví,
- vazbu na star governance context.

Povolené stavy:

- `available`
- `selected`
- `onboarding_incomplete`
- `onboarding_ready`
- `archived`

Musí reagovat na:

- create,
- select,
- extinguish (soft delete),
- onboarding update,
- branch create,
- branch promote.

BE omezení:

- všechny downstream read/write operace musí být galaxy-scoped,
- bez cross-galaxy relation linking,
- extinguish musí být realizován přes domain eventy, ne hard delete.

## 5.2 Star (governance vrstva)

Backend vlastní:

- policy lock state,
- reference na physics profile,
- stav governance pravidel,
- stav control-plane readiness.

Povolené stavy:

- `unlocked`
- `locked`
- `policy_ready`
- `physics_ready`
- `governance_warning`

Musí reagovat na:

- lock,
- profile apply,
- profile migration,
- runtime query,
- metrics request.

BE omezení:

- star gate může blokovat planet/civilization write eligibility,
- governance kontroly musí být deterministické a vysvětlitelné,
- dotaz na star state nesmí mutovat runtime data.

## 5.3 Planet (table aggregate)

Backend vlastní:

- table identitu,
- contract boundary,
- capability attachment boundary,
- population container,
- visual placement metadata.

Povolené stavy:

- `absent`
- `placed`
- `empty`
- `configured`
- `seeded`
- `active`
- `archived`

Musí reagovat na:

- placement,
- rename/reclassify,
- contract update,
- seed rows,
- visualization refresh request.

BE omezení:

- planeta je table/container boundary, nikdy row objekt,
- contract update nesmí tiše mutovat existující row data,
- capability attachment musí být verzovatelný.

## 5.4 Moon (capability modul, ne row)

Backend vlastní:

- capability identitu,
- validation/typing behavior,
- formula behavior,
- bridge behavior,
- contract-level efekty.

Povolené stavy:

- `unavailable`
- `selectable`
- `assembled`
- `previewed`
- `committed`
- `superseded`

Musí reagovat na:

- capability assembly,
- capability preview,
- contract commit,
- capability replacement/versioning.

BE omezení:

- moon capability state žije na planet/table contract vrstvě,
- moon capability ovlivňuje civilization validation/projection přes contract semantiku,
- žádné kanonické row CRUD endpointy na `/moons*`.

## 5.5 Civilization (row instance)

Backend vlastní:

- row identitu,
- row data payload,
- lifecycle state,
- mineral hodnoty,
- validation outcomes,
- bond eligibility state.

Povolené stavy:

- `absent`
- `draft`
- `previewed`
- `active`
- `invalid`
- `blocked`
- `linked`
- `extinguished`
- `historical`

Musí reagovat na:

- create,
- ingest,
- mutate,
- mineral update,
- bond link/unlink,
- extinguish (soft delete),
- projection replay.

BE omezení:

- kanonický row CRUD/mutation namespace je `/civilizations*`,
- OCC je povinné pro mutate/extinguish cesty,
- row extinguish musí produkovat soft-delete event history,
- replay musí konvergovat se snapshot a table projekcemi.

## 5.6 Mineral (typed hodnota na row)

Backend vlastní:

- mineral key,
- typed value,
- source type,
- validation status,
- formula/calculation-derived status.

Povolené stavy:

- `empty`
- `populated`
- `invalid`
- `calculated`
- `blocked`
- `stale`
- `archived_with_row`

Musí reagovat na:

- direct edit,
- parser intent,
- formula recompute,
- validator output,
- guardian blocking rule.

BE omezení:

- mineral nikdy není samostatná row entita,
- typed validace musí proběhnout před commit accept,
- calculated hodnoty musí držet source provenance.

## 5.7 Bond (relace)

Backend vlastní:

- source/target identitu,
- bond type,
- relation lifecycle,
- cross-planet implikace.

Povolené stavy:

- `absent`
- `draft`
- `previewed`
- `active`
- `blocked`
- `extinguished`
- `historical`

Musí reagovat na:

- preview,
- create,
- retype,
- extinguish (soft delete),
- blocking rule,
- scope mismatch.

BE omezení:

- link validace musí být explicitní a vysvětlitelná,
- blocked relation musí vracet strukturovaný reason payload,
- extinguish používá soft-delete, ne fyzický delete.

## 5.8 Branch (izolovaná timeline)

Backend vlastní:

- branch identitu,
- branch název,
- branch event timeline,
- promote state.

Povolené stavy:

- `absent`
- `active`
- `selected`
- `diverged`
- `promotable`
- `promoted`
- `closed`

Musí reagovat na:

- create,
- select,
- timeline writes,
- promote,
- close.

BE omezení:

- branch musí izolovat read/write scope od main timeline,
- promote musí deterministicky replayovat branch eventy do main,
- branch není UI-only draft stack.

## 5.9 Star Core (control plane)

Backend vlastní:

- policy state,
- runtime state,
- pulse data,
- domain metrics,
- outbox status.

Povolené stavy:

- `nominal`
- `warning`
- `degraded`
- `locked`
- `action_required`

Musí reagovat na:

- policy lock,
- profile migration,
- outbox run once,
- status query,
- metrics request.

BE omezení:

- star core je operator/control-plane doména, ne row authoring cesta,
- control-plane akce musí být auditovatelné,
- runtime health a outbox viditelnost musí být machine-readable.

## 6. Cross-domain interaction constraints (BE)

1. Galaxy je povinný parent scope pro Planet, Civilization, Bond, Branch, Star Core.
2. Star řídí readiness/policy, ale přímo neprovádí row-level write.
3. Planet hostuje contract a capability semantiku pro chování civilization.
4. Moon capability mění validation/formula/bridge chování nepřímo přes contract vrstvu.
5. Civilization je primární mutovatelná datová jednotka a musí zůstat oddělená od capability identity.
6. Bond operace musí vždy exponovat validitu, scope a impact metadata.
7. Branch izolace musí chránit main timeline před nereviewovanými zápisy.
8. Star Core operace musí zůstat side-plane a auditovatelné.

## 7. BE MVP closure checklist

Globální:

- [ ] Kanonické namespace enforce (`/civilizations*` row, bez `/asteroids*`).
- [ ] Moon capability cesty jsou contract-driven a oddělené od row CRUD.
- [ ] OCC + idempotency enforce na všech row/bond mutating endpointech.
- [ ] Soft-delete only tam, kde to lifecycle vyžaduje.
- [ ] Runtime scope enforcement (`user_id + galaxy_id + optional branch_id`) napříč write cestami.

Uzavření domén:

- [ ] Galaxy doména: contract a state transitions aligned.
- [ ] Star doména: contract a governance gate aligned.
- [ ] Planet doména: contract boundary aligned.
- [ ] Moon capability doména: contract aligned.
- [ ] Civilization doména: row lifecycle aligned.
- [ ] Mineral doména: typed-value lifecycle aligned.
- [ ] Bond doména: lifecycle a validation aligned.
- [ ] Branch doména: isolation/promote lifecycle aligned.
- [ ] Star Core doména: control-plane lifecycle aligned.

Quality gates:

- [ ] Targeted domain testy upravené pro všechny dotčené domény.
- [ ] API integration regrese pokrývají kanonické namespace i zakázané aliasy.
- [ ] Projection convergence checky pro replay/snapshot parity prochází.

## 8. Mimo scope tohoto dokumentu

1. Kompletní screen IA/navigation redesign.
2. Kompletní UX journey skripty a visual language.
3. FE komponentové behavior detaily.

Tento soubor definuje pouze backend MVP requirements baseline.
