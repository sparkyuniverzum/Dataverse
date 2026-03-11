# Canonical UX Ontology v1

Status: active (canonical planning baseline)
Date: 2026-03-10
Owner: Product UX + Core FE/BE architecture

## 1. What changed

This document defines the canonical UX ontology baseline for full product rework:

1. one language for product design,
2. one mapping between domain and runtime,
3. one behavior model for core entities,
4. one interaction model for how entities, parser, runtime, and UI surfaces can react to each other.

This is the mandatory base for future end-to-end workflow design.

## 2. Why it changed

The current project needs one explicit canonical ontology baseline:

1. moon = planet capability module,
2. civilization = planet table row instance,
3. `/civilizations*` = canonical runtime CRUD namespace,
4. `/moons*` = compatibility alias only.

## 3. Scope of this document

This version covers only:

1. `A` entity ontology,
2. `B` interaction ontology.

This version does not yet define:

1. full screen architecture,
2. navigation map,
3. full end-to-end user journeys,
4. visual system.

## 4. Canonical decision order

For terminology and interpretation, use this priority order:

1. `domain truth`
2. `runtime truth`
3. `UX language`
4. compatibility alias wording

Compatibility wording may exist, but it must never redefine domain meaning.

## 5. Domain truth

### 5.1 Galaxy

Galaxy is the workspace boundary and tenant scope.
Galaxy owns:

- planet lifecycle scope,
- civilization scope,
- branch timelines,
- onboarding state,
- star governance context.

Galaxy is not:

- a visual tab,
- a branch,
- a session-only selection.

### 5.2 Star

Star is the law and governance layer for one galaxy.
Star owns:

- constitution,
- policy lock state,
- physical profile,
- runtime control context.

Star is not:

- a planet,
- a dashboard card,
- a row-level object.

### 5.3 Planet

Planet is a table aggregate and structural data carrier.
Planet owns:

- table contract boundary,
- civilization population container,
- capability attachment boundary,
- visual placement in workspace.

Planet is not:

- a capability,
- a single row,
- a temporary draft.

### 5.4 Moon

Moon is a capability module attached to a planet contract.
Moon is not a row instance.

Moon capability classes include:

- Dictionary Moon,
- Validation Moon,
- Formula Moon,
- Bridge Moon.

Moon owns:

- capability behavior,
- validation semantics,
- formula semantics,
- bridge/link semantics,
- contract-driven effects on civilization writes and projections.

Moon is not:

- live row population,
- a civilization alias in domain truth,
- a first-class row CRUD entity.

### 5.5 Civilization

Civilization is a row instance on a planet.
It is the live population entity that can be:

- created,
- mutated,
- validated,
- linked,
- extinguished.

Civilization owns:

- row data,
- lifecycle state,
- typed mineral values,
- relation eligibility,
- projection visibility.

Civilization is not:

- a capability module,
- a table contract,
- a planet.

### 5.6 Mineral

Mineral is a typed field value inside civilization data.
Mineral is a fact/value layer, not a standalone population entity.

Mineral owns:

- typed value,
- source type,
- validation outcome,
- formula-derived state when applicable.

### 5.7 Bond

Bond is a relation between civilizations.
Bond owns:

- source-target relation,
- bond semantics,
- lifecycle state,
- link-driven runtime implications.

Bond is not:

- a capability block,
- a planet,
- a branch edge in version control sense.

### 5.8 Branch

Branch is an isolated experimental timeline within one galaxy.
Branch owns:

- isolated event history,
- promote/review lifecycle,
- temporary divergence from main timeline.

Branch is not:

- a visual folder,
- a saved filter,
- a draft object.

### 5.9 Star Core

Star Core is the governance and runtime control plane.
It owns:

- policy,
- physics profile,
- runtime health,
- metrics,
- pulse,
- outbox operations.

Star Core is not:

- the primary editing surface for planets/civilizations,
- the onboarding shell,
- a replacement for timeline or workflow log.

## 6. Runtime truth

Current implementation carries the ontology through these rules:

1. `civilization` is the canonical row runtime term.
2. `/civilizations*` is the canonical row CRUD namespace.
3. `/moons*` is not canonical runtime CRUD and must not be used as row namespace.
4. Moon capability state is contract-driven on planet/table layer.
5. Planet contract and civilization row lifecycle are separate write domains.
6. Runtime scope is always `user_id + galaxy_id (+ optional branch_id)`.

Runtime implication:
`Moon capability != Civilization row`, even when compatibility endpoints still expose `/moons*`.

## 7. UX language

### 7.1 Primary language for new UX work

Default UX vocabulary for new product work must be:

- Galaxy
- Star
- Planet
- Civilization
- Mineral
- Bond
- Branch
- Star Core

### 7.2 Controlled use of `moon`

`Moon` may appear in UX only for capability meaning on planet contract surfaces.
`Moon` must always be qualified as capability (for example: "Moon capability").

### 7.3 Forbidden ambiguity

UX must never use `moon` as synonym for row instance.
Row instance must always be labeled as `civilization`.

## 8. Mapping table

| Layer | Canonical meaning | Allowed label | Forbidden shortcut |
| --- | --- | --- | --- |
| Domain | Moon = capability | `Moon` on capability surfaces | `Moon = row` |
| Domain | Civilization = row | `Civilization` | `Civilization = capability` |
| Runtime | `/civilizations*` = row CRUD | `Civilization` | treating `/moons*` as canonical |
| Runtime | `/moons*` | Not allowed as row CRUD namespace | introducing `/moons*` row lifecycle endpoints |
| UX | planet contract extension | `Moon capability` | plain `Moon` when user might infer row |
| UX | row lifecycle | `Civilization` | `Moon` without qualification |

## 9. Entity ontology

Each entity below is defined by:

1. what it is,
2. why it exists,
3. what it owns,
4. what it can react to,
5. what it can affect,
6. what states it may expose,
7. what the user may do with it,
8. what the UI must not imply about it.

### 9.1 Galaxy entity contract

What it is:
Galaxy is the top workspace boundary.

Why it exists:
It prevents cross-tenant and cross-workspace ambiguity.

What it owns:

- workspace scope,
- onboarding record,
- active branch universe,
- star governance context.

What it can react to:

- create,
- select,
- extinguish,
- onboarding update,
- branch creation,
- branch promote.

What it can affect:

- every read/write scope resolution,
- visible workspace identity,
- available branches,
- available governance context.

States:

- available,
- selected,
- onboarding_incomplete,
- onboarding_ready,
- archived.

User actions:

- list,
- create,
- enter,
- review onboarding,
- switch branch context,
- extinguish.

UI must not imply:

- that galaxy is just a recent file,
- that galaxy switch is harmless if there is active draft state.

### 9.2 Star entity contract

What it is:
Star is the law/governance model for one galaxy.

Why it exists:
It gates and explains higher-order rules before builder/runtime mutation flows.

What it owns:

- policy lock,
- physical profile,
- governance rules,
- control-plane state.

What it can react to:

- lock,
- profile apply,
- profile migrate,
- metrics request,
- runtime query.

What it can affect:

- planet creation gates,
- runtime interpretation,
- governance surfaces,
- explainability copy in restricted flows.

States:

- unlocked,
- locked,
- policy_ready,
- physics_ready,
- governance_warning.

User actions:

- inspect,
- lock,
- apply policy/profile,
- migrate profile,
- inspect runtime.

UI must not imply:

- that star is optional once governance gates are active,
- that it is a decorative metaphor only.

### 9.3 Planet entity contract

What it is:
Planet is the structural data carrier and table aggregate.

Why it exists:
It gives civilization data and capabilities one deterministic container.

What it owns:

- table identity,
- contract boundary,
- capability attachment boundary,
- population container,
- visual placement.

What it can react to:

- placement,
- rename/reclassify,
- contract update,
- seed rows,
- visualization refresh.

What it can affect:

- available civilization schema,
- available capability behavior,
- dashboard aggregates,
- layout and navigation.

States:

- absent,
- placed,
- empty,
- configured,
- seeded,
- active,
- archived.

User actions:

- create/place,
- inspect,
- configure,
- seed,
- navigate into,
- review impact,
- archive.

UI must not imply:

- that planet and schema block are the same object,
- that planet creation automatically means usable population.

### 9.4 Moon entity contract

What it is:
Moon is a capability module attached to a planet contract.

Why it exists:
It explains and structures non-row behavior on the planet layer.

What it owns:

- capability identity,
- validation/typing behavior,
- formula behavior,
- bridge behavior,
- contract-level effects.

What it can react to:

- capability assembly,
- contract commit,
- capability preview,
- contract replacement/versioning.

What it can affect:

- civilization validation,
- allowed mineral values,
- formula projections,
- bond semantics and bridge rules.

States:

- unavailable,
- selectable,
- assembled,
- previewed,
- committed,
- superseded.

User actions:

- inspect capability meaning,
- add/remove capability blocks in builder,
- preview capability effects,
- commit capability changes.

UI must not imply:

- that user is editing row data,
- that capability blocks are civilizations,
- that capability editing is row CRUD.

### 9.5 Civilization entity contract

What it is:
Civilization is the live row instance on a planet.

Why it exists:
It is the primary mutable population entity for day-to-day operator work.

What it owns:

- row identity,
- row data,
- current lifecycle state,
- mineral values,
- validation outcomes,
- bond eligibility.

What it can react to:

- create,
- ingest,
- mutate,
- mineral update,
- bond link/unlink,
- extinguish,
- projection replay.

What it can affect:

- planet row counts,
- dashboard summaries,
- visual runtime state,
- workflow log,
- validation and repair flows.

States:

- absent,
- draft,
- previewed,
- active,
- invalid,
- blocked,
- linked,
- extinguished,
- historical.

User actions:

- create,
- inspect,
- edit,
- enrich minerals,
- link bonds,
- extinguish,
- recover from blocked write.

UI must not imply:

- that civilization is a capability,
- that civilization deletion is hard delete,
- that selection equals committed edit mode.

### 9.6 Mineral entity contract

What it is:
Mineral is a typed fact/value inside civilization data.

Why it exists:
It gives civilization state meaningful, typed, explainable content.

What it owns:

- key,
- typed value,
- source type,
- validation status,
- formula or calculated status where applicable.

What it can react to:

- direct edit,
- parser intent,
- formula recompute,
- validator result,
- guardian/blocking rule.

What it can affect:

- row validity,
- calculated outputs,
- preview warnings,
- downstream governance or bridge rules.

States:

- empty,
- populated,
- invalid,
- calculated,
- blocked,
- stale,
- archived_with_row.

User actions:

- edit,
- inspect source,
- repair invalid value,
- trace formula/calculation origin.

UI must not imply:

- that mineral is an independent row object,
- that calculated value is directly editable when it is not.

### 9.7 Bond entity contract

What it is:
Bond is a relation between civilizations.

Why it exists:
It expresses relation, flow, or guardian semantics between row entities.

What it owns:

- source/target identity,
- bond type,
- relation lifecycle,
- cross-planet implications.

What it can react to:

- preview,
- create,
- retype,
- extinguish,
- blocking rules,
- scope mismatch.

What it can affect:

- graph topology,
- bridge capability outcomes,
- explainability and repair hints,
- dashboard and runtime state.

States:

- absent,
- draft,
- previewed,
- active,
- blocked,
- extinguished,
- historical.

User actions:

- inspect,
- create,
- preview,
- resolve ambiguity,
- extinguish.

UI must not imply:

- that every line is always valid to commit,
- that blocked relation is a silent no-op.

### 9.8 Branch entity contract

What it is:
Branch is an isolated event timeline in one galaxy.

Why it exists:
It allows safe experimentation before promote to main.

What it owns:

- branch identity,
- branch name,
- branch timeline,
- promote state.

What it can react to:

- create,
- select,
- timeline writes,
- promote,
- closure.

What it can affect:

- read scope,
- write scope,
- preview comparison,
- review and merge flows.

States:

- absent,
- active,
- selected,
- diverged,
- promotable,
- promoted,
- closed.

User actions:

- create,
- enter,
- compare,
- review,
- promote.

UI must not imply:

- that branch is only a visual filter,
- that main and branch timelines are interchangeable.

### 9.9 Star Core entity contract

What it is:
Star Core is the governance and runtime control plane.

Why it exists:
It centralizes policy, runtime health, metrics, and operator-level controls.

What it owns:

- policy state,
- runtime state,
- pulse data,
- domain metrics,
- outbox status.

What it can react to:

- policy lock,
- profile migration,
- outbox run once,
- status query,
- metrics request.

What it can affect:

- operator trust,
- governance review,
- remediation actions,
- readiness for release/promote decisions.

States:

- nominal,
- warning,
- degraded,
- locked,
- action_required.

User actions:

- inspect,
- run operator action,
- review metrics,
- confirm policy/governance state.

UI must not imply:

- that star-core actions are part of everyday row editing flow,
- that control-plane operations are reversible like local drafts.

## 10. Interaction ontology

This section defines what core entities and systems may react to each other.
If an interaction is not defined here or in a more specific contract, UX must treat it as unsupported.

### 10.1 Galaxy interactions

Galaxy may react with:

- Star
- Planet
- Branch
- Onboarding
- Star Core

Galaxy may not directly react with:

- Mineral as top-level independent scope
- Bond as cross-galaxy relation

Behavior rule:
Every meaningful user flow starts in one resolved galaxy scope.

### 10.2 Star interactions

Star may react with:

- Galaxy
- Planet creation gate
- Star Core

Star may not directly react with:

- individual mineral editing as primary UX object

Behavior rule:
Star influences governance and readiness, not row-level editing mechanics directly.

### 10.3 Planet interactions

Planet may react with:

- Moon capability
- Civilization
- Bond summaries
- Branch-scoped reads
- visual placement/runtime projection

Planet may not react as if it were:

- a row editor
- a capability itself

Behavior rule:
Planet is the container and contract surface for civilization work.

### 10.4 Moon interactions

Moon may react with:

- Planet contract
- Builder capability assembly
- Civilization validation path
- Formula and bridge effects

Moon may not react as if it were:

- direct row CRUD
- a selected population member

Behavior rule:
Moon changes row behavior indirectly through contract/capability semantics.

### 10.5 Civilization interactions

Civilization may react with:

- Planet
- Mineral
- Bond
- Branch timeline
- Parser intents
- grid/canvas/inspector selection

Civilization may not react as if it were:

- a capability pack
- a global entity outside planet scope

Behavior rule:
Civilization is the primary unit of data editing and explanation in operational UX.

### 10.6 Mineral interactions

Mineral may react with:

- Civilization
- validators
- formulas
- parser intents
- repair hints

Mineral may not react as if it were:

- a free-floating entity without civilization context

Behavior rule:
Mineral editing must remain explainable and typed.

### 10.7 Bond interactions

Bond may react with:

- Civilization to Civilization
- Planet-level bridge implications
- parser preview
- repair hints for blocking or ambiguity

Bond may not react as if it were:

- a loose decorative line without semantic consequences

Behavior rule:
Every bond operation must surface validity, scope, and impact.

### 10.8 Branch interactions

Branch may react with:

- Galaxy
- Planet/Civilization/Bond reads and writes
- compare/review/promote flows

Branch may not react as if it were:

- a draft rail replacement
- a UI-local undo stack

Behavior rule:
Branch is timeline isolation, not widget-local state.

### 10.9 Star Core interactions

Star Core may react with:

- Star
- Galaxy
- runtime health
- metrics
- outbox operations

Star Core may not react as if it were:

- the normal path for creating or editing civilizations

Behavior rule:
Star Core is governance/supporting control plane, not primary authoring surface.

### 10.10 Parser interactions

Parser may react with:

- Planet intents
- Civilization intents
- Mineral intents
- Bond intents
- Branch-aware scope
- explainability and ambiguity handling

Parser may not react as:

- a hidden expert-only sidecar,
- an unreviewable mutation black box.

Behavior rule:
Parser is a first-class intent engine that must always resolve into:

1. understood intent,
2. clarification needed,
3. blocked by rule.

### 10.11 UI surface interactions

Core UI surfaces may react with these entity classes:

- Galaxy Gate <-> Galaxy, onboarding, recent context
- Workspace shell <-> Galaxy, Branch, runtime state
- Main surface <-> Planet, Civilization, Bond
- Inspector/Draft rail <-> selected entity or current draft
- Timeline/log <-> commits, warnings, runtime events, repair hints
- Governance surface <-> Star, Star Core, Branch review

Behavior rule:
No surface may invent its own ontology. All labels and states must map back to sections 5 to 10.

### 10.12 Runtime and error interactions

Runtime may react with UX through:

- preview results,
- validation errors,
- OCC conflicts,
- explainability payloads,
- offline/connectivity state,
- convergence or projection mismatch warnings.

Behavior rule:
Errors must map to:

1. what failed,
2. why it failed,
3. what stayed unchanged,
4. what the user can do next.

## 11. Official guardrails for next design phases

1. End-to-end workflow design must start from this ontology.
2. Screen architecture may not redefine entity meaning.
3. Parser, forms, canvas, grid, and logs must map to the same entity model.
4. Capability editing and row lifecycle must stay distinct in new flows.
5. Compatibility aliases may be explained, but never treated as canonical UX naming.
