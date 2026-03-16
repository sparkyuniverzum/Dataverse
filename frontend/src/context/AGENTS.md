# Frontend Context Agent Guide

Scope: `frontend/src/context/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read `/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md`.
3. Read `/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md`.
4. Read this file.
5. If changes affect workspace entry, also read `/mnt/c/Projekty/Dataverse/frontend/src/components/app/AGENTS.md`.
6. Then edit frontend context modules.

## Local Priorities

1. Context is for session/bootstrap truth, not for hiding product workflow rules.
2. Keep `defaultGalaxy`, auth, and bootstrap state deterministic and testable.
3. If FE cannot reach a valid workspace state without a context value, expose that dependency explicitly.
4. Avoid turning context into a monolithic app-state store.

## Local Validation

1. Run the nearest focused context test.
2. If context affects workspace entry, also run `src/components/app/WorkspaceShell.test.jsx`.
