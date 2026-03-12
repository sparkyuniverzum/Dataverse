# Galaxy Routers Agent Guide

Scope: `app/api/routers/galaxies/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read `/mnt/c/Projekty/Dataverse/app/AGENTS.md`.
3. Read this file.
4. Then edit galaxy router modules.

## Local Priorities

1. Keep endpoint contracts explicit; do not hide workflow meaning in incidental fields.
2. Query endpoints must stay read-only and explainable.
3. Mutating endpoints must preserve idempotency and OCC semantics.
4. If FE depends on workflow truth, prefer adding a canonical read model here instead of asking FE to derive it.
5. New `star_core` or galaxy endpoints must return operator-readable errors with stable `code`.

## High-Risk Areas

1. `star_core.py` contract drift against FE expectations.
2. Reusing existing endpoints for a new workflow without documenting semantics.
3. Silent status transitions that FE cannot distinguish (`accepted` vs `locked` vs `failed`).

## Local Validation

1. Run only focused API/integration tests for changed router contracts.
2. If schema changes, verify router response models match `app/schema_models/`.
