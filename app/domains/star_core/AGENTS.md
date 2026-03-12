# Star Core Domain Agent Guide

Scope: `app/domains/star_core/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read `/mnt/c/Projekty/Dataverse/app/AGENTS.md`.
3. Read this file.
4. Then edit `star_core` domain code.

## Local Priorities

1. `star_core` is canonical governance authority, not a UI convenience layer.
2. Keep workflow truth, policy truth, physics truth, and explainability coherent.
3. FE may explore product flow, but canonical mapping and lock readiness must end here.
4. Avoid mixing query/read-model concerns into command code without an explicit domain reason.
5. Preserve idempotent command behavior and stable replay semantics.

## Canonical Responsibilities

1. Policy profile mapping (`profile_key`, `law_preset`).
2. Physical profile mapping (`physical_profile_key`, `physical_profile_version`).
3. Lock readiness and lock transition truth.
4. Interior orchestration truth once introduced.

## Local Validation

1. Prefer focused tests for `commands`, `queries`, and domain state mapping.
2. If contract semantics change, update the active BE contract docs in the same block.
