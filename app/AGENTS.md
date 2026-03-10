# Backend Runtime Agent Guide

Scope: `app/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. Then edit backend runtime/API modules.
4. Follow root `Collaboration Contract (Mandatory)` for block handoff and `Povel pro tebe`.

## Local Priorities

1. Keep canonical runtime routes on `/civilizations*`; `/moons*` stays compatibility alias.
2. Preserve OCC and idempotency behavior on mutate/extinguish/mineral writes.
3. Do not break projection convergence (`snapshot + tables` must stay consistent).
4. Contract violations must return actionable, repair-ready error messages.

## High-Impact Areas

1. `app/api/routers/` - endpoint behavior and response contract.
2. `app/services/universe/` - projection, lifecycle, contract enforcement.
3. `app/services/parser2/` - parser execution and fallback path.
