# ADR: Moon Capability vs Civilization Row Naming Migration v1

Status: accepted (phase 1 implemented)  
Date: 2026-03-05  
Owner: Core BE/FE architecture

## 1. Context

Current implementation has semantic drift:
1. Domain direction defines `Moon` as planet capability module.
2. Runtime API `/moons*` currently carries row lifecycle payloads.
3. This overload creates ambiguity in code, docs, and onboarding language.

Project direction requires strict ontology:
- `Moon = capability`,
- `Civilization = row`,
- `Mineral = typed key/value inside row`.

## 2. Decision

Keep `/moons*` as backward-compatible runtime alias for row lifecycle during migration.
Introduce canonical row naming target:
- `/civilizations*` for row CRUD.

Capabilities remain contract-driven on planet layer and must not be modeled as row entities.

## 3. Why this decision

1. Removes long-term semantic ambiguity.
2. Avoids sudden breaking API cut.
3. Allows staged migration with explicit compatibility windows.
4. Keeps FE and parser flows stable while contracts converge.

## 4. Migration phases

### Phase 0 (done)

1. Freeze canonical ontology in contract docs:
- Moon capability vs Civilization row split is explicit.
2. Add migration target references in API and contract docs.

### Phase 1 (next)

1. Add `/civilizations*` endpoints as canonical row API.
2. Keep `/moons*` as compatibility alias to same handlers.
3. Include deprecation metadata in `/moons*` responses (header or body marker).

Phase 1 implementation status:
1. `/civilizations*` endpoints added as canonical row API.
2. `/moons*` kept as compatibility alias.

### Phase 2

1. Switch FE row runtime calls to `/civilizations*`.
2. Keep compatibility fallback for legacy clients.
3. Keep contract gates for both surfaces.

### Phase 3

1. Mark `/moons*` as deprecated in OpenAPI and release notes.
2. Enforce migration warning budget and telemetry tracking.

### Phase 4 (major version)

1. Remove `/moons*` row alias.
2. Keep only `/civilizations*` for row lifecycle.

## 5. Compatibility contract

During compatibility window:
1. Response payload shape must remain equivalent between `/moons*` and `/civilizations*`.
2. OCC/idempotency behavior must remain equivalent.
3. Soft-delete semantics must remain equivalent.
4. Scope isolation (`user_id + galaxy_id + branch_id`) must remain equivalent.

## 6. Risks and mitigations

1. Risk: mixed FE usage of old/new naming.
- Mitigation: one FE abstraction layer and CI freeze test for route inventory.

2. Risk: parser output still references historical naming.
- Mitigation: parser semantics remain entity-neutral for row actions; terminology mapping handled in docs and UI labels.

3. Risk: contract drift between moon capability and civilization lifecycle docs.
- Mitigation: dedicated doc gates for ontology markers and gap matrix updates.

## 7. Acceptance criteria

1. Contract docs explicitly enforce `Moon capability != Civilization row`.
2. Migration target `/civilizations*` is documented in API contract.
3. Contract gates include terminology checks and migration references.
4. Release gate remains green for star lock -> first planet -> row lifecycle convergence.

## 8. Out of scope

1. Capability-specific persistent entity (`moon_capabilities`) CRUD.
2. Full parser grammar rename in this phase.
3. UI copy rewrite outside builder/grid surfaces.
