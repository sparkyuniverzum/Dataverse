# Dataverse Agent Operating Guide

Scope: whole repository

## Purpose

This file defines the default operating mode for work in this repo.

Primary goal:

1. keep FE work anchored to canonical backend truth,
2. prevent repeated BE context digging during normal FE tasks,
3. force documentation baseline updates when contract truth changes.

## Mandatory Read Order

For every FE task:

1. read [docs/governance/fe-collaboration-single-source-of-truth-v2CZ.md](/mnt/c/Projekty/Dataverse/docs/governance/fe-collaboration-single-source-of-truth-v2CZ.md),
2. read [docs/governance/fe-operating-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md),
3. read [docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md),
4. then read the nearest local `AGENTS.md` in the touched scope.

For BE-only tasks:

1. read this file,
2. read the nearest local `AGENTS.md`,
3. load the exact contract docs touched by the change.

## Default Working Mode

1. FE work must use the FE baseline packet as the default backend context source.
2. Do not inspect backend code during normal FE implementation if the answer is already present in the baseline packet.
3. Inspect backend code only when:
   - changing backend behavior,
   - packet truth is missing,
   - packet truth is stale or contradicted by runtime/code.
4. If code and packet diverge, stop and update the packet before continuing broad FE implementation.
5. Do not reopen product vision in implementation threads unless the user explicitly asks for strategy or re-direction.

## Canonical Truth Rules

1. Backend is the runtime authority.
2. FE may adapt, normalize, and explain payloads, but must not invent workflow truth.
3. New FE runtime behavior must name:
   - payload source,
   - used fields,
   - FE projection,
   - fallback behavior,
   - guard/test.

## Documentation Duty

When a FE-visible backend contract changes, update in the same block:

1. [docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md),
2. any touched feature contract docs,
3. local `AGENTS.md` instructions if the working order changed.

## Block Close Standard

Every non-trivial block closes with:

1. technical completion,
2. user-visible completion,
3. documentation completion,
4. gate completion.
