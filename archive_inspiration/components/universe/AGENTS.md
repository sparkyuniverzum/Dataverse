# Universe UI Agent Guide

Scope: `frontend/src/components/universe/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. Only then inspect or edit universe runtime files.
4. Follow root `Collaboration Contract (Mandatory)` for block handoff and `Povel pro tebe`.

## Local Priorities

1. Tento archiv uz neni aktivni runtime; ber ho jako technickou knihovnu a historicky zdroj.
2. Preserve deterministic helper/controller logic and do not recreate monolith surfaces here.
3. Monolith creation is prohibited in this scope; split any salvaged logic into focused files/hooks.
4. Any lifecycle/mineral behavior change must keep canonical API mapping explicit.
5. Keep naming/API mapping explicit: `civilization` is row runtime entity, `moon` is capability layer over table/planet in UX.
6. Product `NOK` surfaces removed v cleanup batchich se do tohoto archivu nesmi vracet.
7. User-facing copy in retained helper docs/tests must stay Czech and understandable where applicable.

## Key Files

1. `QuickGridOverlay.jsx` - operator workflow surface kept only as archive reference.
2. `useMoonCrudController.js` - canonical write routes and OCC handling.
3. `useUniverseRuntimeSync.js` - runtime sync orchestration reference.
4. `starContract.js` - governance and star payload normalization reference.

## Local Validation

1. Archived tests are reference-only; do not re-enable them in active suite without an explicit FE block.
2. When reviving a helper from this archive, bring back only the matching focused test.
