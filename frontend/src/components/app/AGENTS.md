# App Shell Agent Guide

Scope: `frontend/src/components/app/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. If work touches galaxy workspace handoff, also read `/mnt/c/Projekty/Dataverse/frontend/src/components/universe/AGENTS.md`.
4. Then edit app shell components.

## Local Priorities

1. Keep login, workspace handoff, and connectivity states minimal and explicit.
2. Do not bury workspace-entry truth in app-shell convenience props without documenting it.
3. Preserve Czech UI copy and readable operator-facing states.
4. If a workspace block depends on `defaultGalaxy` or session bootstrap, make that dependency obvious here.

## Local Validation

1. `npm --prefix frontend run test -- src/App.test.jsx src/components/app/WorkspaceShell.test.jsx`
2. If auth/session flow changes, include the nearest focused context test too.
