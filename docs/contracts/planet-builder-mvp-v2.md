# Planet Builder MVP Contract v2

Status: normative target (implementation baseline)
Date: 2026-03-05
Owner: Core BE/FE
Depends on: `docs/contracts/semantic-constitution-v1.md`, `docs/contracts/star-physics-laws-v2.md`, `docs/contracts/table-contract-v1.md`, `docs/contracts/moon-contract-v1.md`, `docs/contracts/civilization-contract-v1.md`, `docs/contracts/mineral-contract-v1.md`, `docs/contracts/api-v1.md`

## 1. Purpose

Define one strict, implementation-ready contract for the core builder layer:
- Planet (table carrier),
- Moon capability (table extension),
- Civilization (row lifecycle),
- Mineral (typed key/value facts).

The goal is to remove semantic drift and keep one deterministic flow from onboarding to first usable grid.

## 2. Canonical ontology (frozen for this MVP)

1. Galaxy = Workspace tenant boundary.
2. Star = constitution and physical laws for one galaxy.
3. Planet = table aggregate and data carrier.
4. Moon = capability module attached to a planet contract.
5. Civilization = row instance on a planet.
6. Mineral = typed field value (`key + typed_value`) inside civilization.

### 2.1 Non-negotiable semantic rule

`Moon` and `Civilization` are not synonyms.
- Moon is capability.
- Civilization is row data.

## 3. Ownership by layer

1. Star layer owns immutable laws after lock.
2. Planet layer owns table lifecycle and contract boundary.
3. Moon layer owns capability payload and capability effects.
4. Civilization layer owns create/mutate/extinguish row lifecycle.
5. Mineral layer owns typing, validation, and facts projection.

## 4. Mandatory end-to-end flow (first planet)

1. Star lock gate:
- Input: selected star profile and physical profile.
- Rule: no planet creation before lock.
- Output: `lock_status=locked`.

2. Planet placement:
- Input: DnD drop point on canvas.
- Rule: deterministic position mapping and non-overlapping layout constraints.
- Output: first planet created with empty schema mode.

3. Moon capability assembly:
- Input: Lego blocks only (no free text schema names).
- Rule: only predefined capability blocks allowed.
- Output: preview contract payload.

4. Commit:
- Input: preview payload.
- Rule: atomic commit (`contract upsert + optional seed rows`).
- Output: new contract version visible on planet.

5. Civilization seed:
- Input: preset seed rows.
- Rule: must pass contract validation and typing.
- Output: non-empty grid.

6. Convergence:
- Rule: `/universe/snapshot`, `/universe/tables`, 3D nodes, and grid rows must match for selected planet.
- Output: convergence report `ok=true`.

## 5. Builder interaction contract (UI)

1. No keyboard typing for schema in MVP flow.
2. Every step must render "why this step exists" explanatory copy.
3. CTA is disabled until required blocks are complete.
4. Builder state machine:
- `Idle -> StarLockedRequired -> BlueprintOpen -> DraggingPlanet -> PlanetPlaced -> CameraSettled -> BuilderOpen -> CapabilityAssembling -> PreviewReady -> Committing -> Converged`
5. Error state must be recoverable:
- `ErrorRecoverable` returns to last valid state, not to full reset.

## 6. Moon capability classes (MVP minimum)

1. Dictionary Moon:
- controlled vocabularies and categorical normalization.

2. Validation Moon:
- required/type/validator/unique constraints.

3. Formula Moon:
- derived minerals and explicit formula error projection.

4. Bridge Moon:
- relation and flow semantics between planets.

Each class must be represented by at least one integration scenario.

## 7. Civilization and Mineral runtime contract

1. Civilization lifecycle:
- create, mutate, extinguish (soft delete only).

2. OCC and idempotency:
- mutate/extinguish supports expected event sequence.
- every write supports idempotency key.

3. Mineral facts:
- value types: `string|number|boolean|datetime|json|null`.
- source types: `value|metadata|calculated`.
- invalid or circular formulas must be explicit in facts.

## 8. Planet visual determinism rules

1. Planet size must be deterministic from row count:
- `size_factor = clamp(1.0 + 0.22 * log10(max(rows, 1)), 1.0, 2.4)`.

2. Planet activity luminosity must be deterministic from write pressure:
- `luminosity = clamp(0.2 + 0.8 * write_pressure, 0.2, 1.0)`.

3. Corrosion must be deterministic from inactivity and integrity:
- `corrosion = clamp(0.6 * inactivity_ratio + 0.4 * invalid_ratio, 0.0, 1.0)`.

4. Phase thresholds:
- `ACTIVE` when `corrosion < 0.35`,
- `CORRODING` when `0.35 <= corrosion < 0.7`,
- `CRITICAL` when `corrosion >= 0.7`.

5. Same runtime input must always produce same visual output.

## 9. API contract requirements (strict)

1. Planet lifecycle is managed via `/planets`.
2. Capability commit is managed via `/contracts/{table_id}`.
3. Civilization writes must be first-class row endpoints.
4. Snapshot and tables are the only projection sources for grid/3D convergence checks.
5. Builder UI must not call direct low-level asteroid endpoints for primary row flow.

## 10. Compatibility and migration guard

Current implementation contains transitional naming overlap.
Until dedicated civilization endpoint namespace is finalized:
- existing first-class row flow may be served by current `/moons` runtime surface,
- semantic contract remains frozen as:
  - Moon = capability,
  - Civilization = row.

Any compatibility alias must be marked and tested as transitional.

## 11. Error model and rollback behavior

1. `422` contract violation:
- no event append and no partial projection updates.

2. `409` OCC conflict:
- client refreshes projection and may retry with new expected sequence.

3. Commit failure in builder:
- no partial schema state should remain visible as committed.

4. Seed failure:
- contract commit remains valid,
- failed seed is reported explicitly,
- user can retry seed operation safely with idempotency.

## 12. Required gates for this contract

1. BE integration gate:
- `star lock -> first planet -> moon capability commit -> civilization create/mutate/extinguish -> convergence`.

2. FE convergence gate:
- projection and grid stay converged after stream replay and lifecycle transitions.

3. FE persistence gate:
- selected planet and grid open state survive reload per galaxy scope.

4. Build gate:
- production build green with no contract/parity test regressions.

## 13. Definition of Done (go/no-go)

1. User can complete first planet without schema typing.
2. Capability assembly modifies contract deterministically.
3. Civilization rows pass strict contract validation.
4. Mineral facts are typed and projection-stable.
5. Soft delete only is preserved across all write paths.
6. Convergence gate is green after create, mutate, and extinguish.
7. CI pipeline includes all required gates from section 12.
