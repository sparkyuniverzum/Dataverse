# Backend MVP Requirements From Canonical UX Ontology v1

Status: archived historical mirror (inactive reference)
Date: 2026-03-11
Owner: Core BE architecture

## 1. What changed

- [x] 2026-03-11 Added one backend-only MVP requirements baseline extracted from `archive/en/canonical-ux-ontology-v1.md`.
- [x] 2026-03-11 Converted ontology language into implementation constraints for API, data model, lifecycle, and runtime guards.
- [x] 2026-03-11 Added a closure checklist for BE hardening scope tracking.

## 2. Why it changed

We need one explicit BE MVP contract that:

1. translates ontology into executable backend scope,
2. removes ambiguity between capability vs row concepts,
3. locks canonical namespaces and mutation constraints before further development blocks.

## 3. Source evidence

Ontology source was read from:

- `docs/P0-core/contracts/archive/en/canonical-ux-ontology-v1.md`
- Sections used: Domain truth, Runtime truth, Entity ontology, Interaction ontology.

Evidence command set used during extraction:

```bash
sed -n '1,260p' docs/P0-core/contracts/archive/en/canonical-ux-ontology-v1.md
sed -n '260,560p' docs/P0-core/contracts/archive/en/canonical-ux-ontology-v1.md
sed -n '560,920p' docs/P0-core/contracts/archive/en/canonical-ux-ontology-v1.md
```

## 4. Canonical BE MVP rules (global)

1. Canonical row runtime namespace is `/civilizations*` only.
2. Moon is a planet capability domain, not a row domain.
3. `/moons*` must not be introduced as canonical row CRUD surface.
4. `/asteroids*` is forbidden runtime/API surface.
5. Extinguish/delete semantics for row and bond lifecycle are soft-delete only.
6. Runtime scope must always resolve as `user_id + galaxy_id (+ optional branch_id)`.
7. Planet contract writes and civilization row writes are separate domains.
8. OCC + idempotency are mandatory for mutating flows.
9. Parser input is intent-level; execution is atomic-task level with deterministic validation gates.

## 5. Entity-level BE MVP requirements

## 5.1 Galaxy (tenant and workspace boundary)

Backend owns:

- workspace scope identity,
- onboarding record state,
- active branch universe mapping,
- star governance context binding.

Allowed states:

- `available`
- `selected`
- `onboarding_incomplete`
- `onboarding_ready`
- `archived`

Must react to:

- create,
- select,
- extinguish (soft delete),
- onboarding update,
- branch create,
- branch promote.

BE constraints:

- all downstream reads/writes must be galaxy-scoped,
- no cross-galaxy relation linking,
- extinguish must cascade via domain events, not hard delete.

## 5.2 Star (governance law layer)

Backend owns:

- policy lock state,
- physics profile reference,
- governance rule state,
- control-plane readiness state.

Allowed states:

- `unlocked`
- `locked`
- `policy_ready`
- `physics_ready`
- `governance_warning`

Must react to:

- lock,
- profile apply,
- profile migration,
- runtime query,
- metrics request.

BE constraints:

- star gates can block planet/civilization write eligibility,
- governance checks must be deterministic and explainable,
- star state must be queryable without mutating runtime data.

## 5.3 Planet (table aggregate)

Backend owns:

- table identity,
- contract boundary,
- capability attachment boundary,
- population container,
- visual placement metadata.

Allowed states:

- `absent`
- `placed`
- `empty`
- `configured`
- `seeded`
- `active`
- `archived`

Must react to:

- placement,
- rename/reclassify,
- contract update,
- seed rows,
- visualization refresh request.

BE constraints:

- planet is the table/container boundary, never a row object,
- contract updates must not silently mutate existing row data,
- capability attachment must be versionable.

## 5.4 Moon (capability module, not row)

Backend owns:

- capability identity,
- validation/typing behavior,
- formula behavior,
- bridge behavior,
- contract-level effects.

Allowed states:

- `unavailable`
- `selectable`
- `assembled`
- `previewed`
- `committed`
- `superseded`

Must react to:

- capability assembly,
- capability preview,
- contract commit,
- capability replacement/versioning.

BE constraints:

- moon capability state lives on planet/table contract layer,
- moon capability must affect civilization validation/projection through contract semantics,
- no canonical row CRUD endpoints on `/moons*`.

## 5.5 Civilization (row instance)

Backend owns:

- row identity,
- row data payload,
- lifecycle state,
- mineral values,
- validation outcomes,
- bond eligibility state.

Allowed states:

- `absent`
- `draft`
- `previewed`
- `active`
- `invalid`
- `blocked`
- `linked`
- `extinguished`
- `historical`

Must react to:

- create,
- ingest,
- mutate,
- mineral update,
- bond link/unlink,
- extinguish (soft delete),
- projection replay.

BE constraints:

- canonical row CRUD/mutation namespace is `/civilizations*`,
- OCC is required on mutate/extinguish paths,
- row extinguish must produce soft-delete event history,
- replay must converge with snapshot and table projections.

## 5.6 Mineral (typed value on row)

Backend owns:

- mineral key,
- typed value,
- source type,
- validation status,
- formula/calculation-derived status.

Allowed states:

- `empty`
- `populated`
- `invalid`
- `calculated`
- `blocked`
- `stale`
- `archived_with_row`

Must react to:

- direct edit,
- parser intent,
- formula recompute,
- validator output,
- guardian blocking rule.

BE constraints:

- mineral is never standalone row entity,
- typed validation must run before commit acceptance,
- calculated values must preserve source provenance.

## 5.7 Bond (relation)

Backend owns:

- source/target identity,
- bond type,
- relation lifecycle,
- cross-planet implications.

Allowed states:

- `absent`
- `draft`
- `previewed`
- `active`
- `blocked`
- `extinguished`
- `historical`

Must react to:

- preview,
- create,
- retype,
- extinguish (soft delete),
- blocking rule,
- scope mismatch.

BE constraints:

- link validation must be explicit and explainable,
- blocked relation must return structured reason payload,
- extinguish uses soft-delete, not physical delete.

## 5.8 Branch (isolated timeline)

Backend owns:

- branch identity,
- branch name,
- branch event timeline,
- promote state.

Allowed states:

- `absent`
- `active`
- `selected`
- `diverged`
- `promotable`
- `promoted`
- `closed`

Must react to:

- create,
- select,
- timeline writes,
- promote,
- close.

BE constraints:

- branch must isolate read/write scope from main timeline,
- promote must replay branch events deterministically into main,
- branch is not a UI-only draft stack.

## 5.9 Star Core (control plane)

Backend owns:

- policy state,
- runtime state,
- pulse data,
- domain metrics,
- outbox status.

Allowed states:

- `nominal`
- `warning`
- `degraded`
- `locked`
- `action_required`

Must react to:

- policy lock,
- profile migration,
- outbox run once,
- status query,
- metrics request.

BE constraints:

- star core is operator/control-plane domain, not row authoring path,
- control-plane actions must be auditable,
- runtime health and outbox visibility must be machine-readable.

## 6. Cross-domain interaction constraints (BE)

1. Galaxy is mandatory parent scope for Planet, Civilization, Bond, Branch, Star Core.
2. Star governs readiness and policy, but does not perform row-level writes directly.
3. Planet hosts contract and capability semantics for civilization behavior.
4. Moon capability modifies validation/formula/bridge behavior indirectly through contract layer.
5. Civilization is primary mutable data unit and must remain independent from capability identity.
6. Bond operations must expose validity, scope, and impact metadata.
7. Branch isolation must protect main timeline from unreviewed writes.
8. Star Core operations must remain side-plane and auditable.

## 7. BE MVP closure checklist

Global:

- [ ] Canonical namespaces enforced (`/civilizations*` row, no `/asteroids*`).
- [ ] Moon capability paths are contract-driven and separated from row CRUD.
- [ ] OCC + idempotency enforced on all row/bond mutating endpoints.
- [ ] Soft-delete only for extinguish semantics where lifecycle requires it.
- [ ] Runtime scope enforcement (`user_id + galaxy_id + optional branch_id`) across all writes.

Domain closure:

- [ ] Galaxy domain contract and state transitions aligned.
- [ ] Star domain contract and governance gates aligned.
- [ ] Planet domain contract boundary aligned.
- [ ] Moon capability domain contract aligned.
- [ ] Civilization row lifecycle aligned.
- [ ] Mineral typed-value lifecycle aligned.
- [ ] Bond lifecycle and validation aligned.
- [ ] Branch isolation/promote lifecycle aligned.
- [ ] Star Core control-plane lifecycle aligned.

Quality gates:

- [ ] Targeted domain tests updated for all affected domains.
- [ ] API integration regressions cover canonical namespaces and forbidden aliases.
- [ ] Projection convergence checks pass for replay/snapshot parity.

## 8. Out of scope for this document

1. Full screen IA/navigation redesign.
2. Full UX journey scripts and visual language.
3. FE component-level behavior details.

This file defines backend MVP requirements baseline only.
