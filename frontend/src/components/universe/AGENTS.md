# Universe UI Agent Guide

Scope: `frontend/src/components/universe/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. Only then inspect or edit universe runtime files.
4. Follow root `Collaboration Contract (Mandatory)` for block handoff and `Povel pro tebe`.

## Local Priorities

1. Preserve deterministic UI flow across Sidebar, Grid, Setup panel.
2. Keep workflow log unified (UI + backend stream + runtime impact/repair events).
3. Avoid adding more logic into `UniverseWorkspace.jsx` unless necessary; prefer small helper modules.
4. Monolith creation is prohibited in this scope; split new behavior into focused files/hooks.
5. Any lifecycle/mineral behavior change must keep existing e2e path stable.

## Key Files

1. `UniverseWorkspace.jsx` - orchestration, runtime integration.
2. `QuickGridOverlay.jsx` - operator workflow, composers, workflow log.
3. `WorkspaceSidebar.jsx` - moon/civilization inspector summary.
4. `useMoonCrudController.js` - canonical write routes and OCC handling.

## Local Validation

1. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.civilizations.test.jsx`
2. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.minerals.test.jsx`
3. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
