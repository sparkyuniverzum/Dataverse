# Staging E2E Agent Guide

Scope: `frontend/e2e/staging/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. Then run or edit staging smoke tests.
4. Follow root `Collaboration Contract (Mandatory)` for block handoff and `Povel pro tebe`.

## Local Priorities

1. Prefer deterministic signals over timing assumptions.
2. Avoid nested long waits inside `expect.poll`.
3. Keep each step independently diagnosable (`[e2e-step]` logs).
4. If a row/planet selector is flaky, use explicit fallback with transparent log output.

## Canonical Smokes

1. `npm --prefix frontend run test:e2e:workspace-starlock`
2. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
3. `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`
4. `npm --prefix frontend run test:e2e:planet-moon-preview`

## Execution Cadence

1. Do not run all canonical smokes after each micro-change.
2. During active implementation, prefer focused unit/helper tests and one targeted smoke only when needed.
3. Run full canonical smoke set as a bundled regression gate after multiple completed blocks.

## Failure Triage

1. Inspect `frontend/test-results/*/error-context.md` first.
2. Confirm whether failure is selection, write ack, or assertion mismatch.
3. Patch helper logic before widening step timeouts.
