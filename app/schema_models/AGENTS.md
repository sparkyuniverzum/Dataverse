# Schema Models Agent Guide

Scope: `app/schema_models/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read `/mnt/c/Projekty/Dataverse/app/AGENTS.md`.
3. Read this file.
4. Then edit API/public schema models.

## Local Priorities

1. Schema models are public contract truth, not a dumping ground for internal convenience fields.
2. Field names must stay stable and English.
3. Additive changes are preferred; breaking removals require explicit contract coordination.
4. If FE depends on a distinction, encode it explicitly in schema instead of forcing FE inference.
5. Keep response models aligned with active CZ contract docs.

## Local Validation

1. Verify router annotations and schema models stay aligned.
2. If you add enums or workflow states, make their allowed values explicit and documented.
