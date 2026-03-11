# UX Journeys & Visual Language v1

Status: active (UX journey baseline)
Date: 2026-03-11
Owner: Product UX + FE design system

## 1. Purpose

Define critical user journeys and visual language so that Dataverse delivers:

1. premium spatial experience (`wow`),
2. operator-grade speed and clarity,
3. deterministic action feedback and trust.

## 2. Experience strategy

Dataverse uses:

1. cinematic context for orientation and emotional impact,
2. tactical HUD for continuous status,
3. high-speed operational grid for repetitive data work.

Rule:
`Cinematic shell + operational core`.

## 3. Critical journeys (MVP)

## 3.1 J1 - Nexus contact and galaxy selection

Goal:
Operator enters system and resolves workspace scope.

Flow:

1. `Nexus` screen presents central 3D anchor model.
2. HUD lists existing galaxies and primary CTA `Initialize new Galaxy`.
3. Operator selects or creates galaxy.

Success criteria:

1. galaxy scope is explicit before entering workspace,
2. no ambiguous “global” state.

## 3.2 J2 - Seamless transition into workspace

Goal:
Avoid generic loading break and preserve immersion.

Flow:

1. action triggers camera fly-through transition into selected galaxy,
2. transition ends on tactical grid and workspace shell,
3. onboarding state is visible (`onboarding_incomplete` or `onboarding_ready`).

Success criteria:

1. transition can be skipped,
2. operational controls available immediately after transition.

## 3.3 J3 - Star ignition and policy lock

Goal:
User understands governance gate before building planets.

Flow:

1. star appears and stabilizes in workspace center,
2. Star Core ring exposes key statuses,
3. user executes `Lock Policy`,
4. state updates from `UNLOCKED` to `LOCKED/POLICY_READY`.

Success criteria:

1. policy lock action is explicit and reversible only by allowed governance flow,
2. onboarding progression updates visibly.

## 3.4 J4 - Star Core dive and governance operation

Goal:
Control-plane actions feel high-value but remain deterministic.

Flow:

1. user enters Star Core (dive transition),
2. governance/physics controls are adjusted and confirmed,
3. pulse/metrics indicate resulting state,
4. user exits back to workspace context.

Success criteria:

1. no loss of prior workspace selection,
2. governance actions are auditable and clearly separated from row CRUD.

## 3.5 J5 - Planet placement and structure setup

Goal:
Operator creates data container with clear empty state.

Flow:

1. user places planet on orbit,
2. planet transitions from wireframe to active container shell,
3. HUD displays `POPULATION: 0` and required next action.

Success criteria:

1. empty container state is unambiguous,
2. next step is clearly signposted.

## 3.6 J6 - Civilization creation and mineral editing

Goal:
Fast day-to-day data authoring.

Flow:

1. user creates civilization (row),
2. operation layer (grid/command) is primary editing surface,
3. scene reflects updates in near-real-time,
4. mineral edits show typed validation feedback.

Success criteria:

1. no blocking cinematic for repetitive edits,
2. invalid/blocked states always include repair hint.

## 3.7 J7 - Moon capability attach and effect propagation

Goal:
Show capability impact without confusing capability with row.

Flow:

1. user enters planet capability mode,
2. attaches moon module to capability slots,
3. capability commit applies effects to row validation/formula behavior,
4. minerals indicate computed/locked state with provenance.

Success criteria:

1. no moon-as-row implication,
2. capability impact is traceable in UI.

## 3.8 J8 - Bond creation and extinguish safety

Goal:
Make relations intuitive and safe.

Flow:

1. user links source and target civilizations,
2. preview exposes validity and scope checks,
3. commit creates active bond,
4. extinguish shows non-destructive ghost history state.

Success criteria:

1. blocked links provide exact reason,
2. no hard-delete behavior or visual disappearance without trace.

## 4. Visual language system

## 4.1 Spatial ontology rendering

1. Galaxy = workspace boundary atmosphere.
2. Star = governance center anchor.
3. Planet = structural container bodies on orbit.
4. Moon = capability modules attached to planet contract ring.
5. Civilization = surface population nodes.
6. Bond = semantic energy links between civilization nodes.

## 4.2 Material and density

1. Scene: volumetric depth, restrained glow, high contrast for readability.
2. HUD: translucent glass, low-noise typography, concise operator copy.
3. Grid: clean data-dense layout with premium micro-motion, no visual clutter.

## 4.3 Motion guidelines

1. Motion explains state change, mode change, or scope transition.
2. Idle animation must not distract from operation layer.
3. Repetitive operations use minimal motion.

## 4.4 Color semantics

1. Nominal/stable: cool blue spectrum.
2. Warning/gate pending: amber.
3. Blocked/error: red with repair affordance.
4. Branch context: subtle tonal shift plus explicit textual badge.

## 5. Interaction grammar (shape logic)

1. Planet capability ring exposes moon-only slots.
2. Civilization surface grid exposes row population slots.
3. Bond linking is civilization-to-civilization only.
4. Invalid drop target must reject with clear visual + textual feedback.

## 6. UX quality gates (must pass)

1. Every critical action has immediate feedback within 200 ms.
2. Every failure has actionable next step.
3. No journey step depends on hidden controls.
4. Reduce-motion mode keeps full functional parity.
5. Operator can complete J5+J6 without mandatory long animation.

## 7. Anti-patterns (forbidden)

1. Cinematic transitions on every row edit.
2. Full-screen opaque modal over operational context for complex review tasks.
3. Ambiguous labels that blur moon capability vs civilization row.
4. Effects-first visuals that hide commit/repair controls.
