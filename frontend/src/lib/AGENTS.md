# Frontend Data Access Agent Guide

Scope: `frontend/src/lib/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. If work touches universe runtime payloads, also read `/mnt/c/Projekty/Dataverse/frontend/src/components/universe/AGENTS.md`.
4. Then edit frontend data-access helpers.

## Local Priorities

1. Keep API wrappers thin and canonical.
2. Do not let `lib` become a second workflow engine; derive as little as possible here.
3. Preserve backend truth and expose response shape clearly to calling layers.
4. If an endpoint contract is unstable or missing, stop and point to the BE contract gap instead of inventing fallback semantics.

## Local Validation

1. Run focused tests for the consuming feature.
2. If endpoint shape changes, verify matching docs in `docs/P0-core/contracts/aktivni/`.
