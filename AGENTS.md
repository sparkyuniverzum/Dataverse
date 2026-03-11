# Dataverse Agent Rules

Scope: entire repository.

## Mandatory First Step On Every Context Load

1. Read this file first.
2. Read the nearest local `AGENTS.md` in the subdirectory you are working in.
3. Continue only after both rule files are loaded.

## Core Working Rules

1. Keep changes small and explicit; avoid hidden side effects.
2. Do not expand monolith files without clear need; prefer focused helpers and adapters.
3. Monolith creation is prohibited: do not introduce new oversized all-in-one files/components/modules.
4. When logic grows, split by responsibility into small composable units (helpers/hooks/services).
5. For flaky tests, stabilize logic first, then assertions.
6. Keep FE/BE terminology aligned: `civilization` is canonical, `moon` is UX alias.
7. Keep workflow logs operator-readable and chronologically consistent.

## Collaboration Contract (Mandatory)

1. Work in implementation blocks.
2. Agent handles: analysis, implementation, local logic checks, and a concise change summary.
3. User handles: running requested tests and performing git commit.
4. After every block, agent must provide `Povel pro tebe` with exact copy/paste commands.
5. Do not claim block completion without an explicit command list for user execution.
6. For UX-first, refactor, or product-experience work, load and follow `docs/P0-core/governance/human-agent-alignment-protocol-v1.md` before claiming scope, success, or closure.

## Test Cadence (Mandatory)

1. Per implementation block: run only focused/unit or narrow-scope tests relevant to changed files.
2. Do not request the full long-running staging e2e suite after every single block.
3. Run long staging smokes as a bundled gate after a series of blocks, or before merge/release.
4. If a block touches workspace entry/grid orchestration, include at most one targeted staging smoke as a spot-check.

## Fast Navigation

1. Frontend runtime universe: `frontend/src/components/universe/`
2. Staging e2e flows: `frontend/e2e/staging/`
3. Backend API/runtime: `app/`
4. Integration and regression tests: `tests/`
5. Contracts and rollout docs: `docs/P0-core/contracts/`, `docs/P0-core/release/`

## Validation Baseline

1. `npm --prefix frontend run format:check`
2. `npm --prefix frontend run test -- src/components/universe/QuickGridOverlay.civilizations.test.jsx`
3. `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
4. `pytest -q tests/test_api_integration.py` (release/hardening gate)
