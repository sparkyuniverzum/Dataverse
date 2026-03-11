# UX Refactor Bundled Gate Plan - 2026-03-10

Status: ready to execute
Scope: post-Slice-14 FE/contract closure bundle
Owner: Core FE + user final gate runner

## Goal

Record one explicit bundled gate for the completed UX refactor so closure is backed by repeatable evidence, not just per-slice focused checks.

## Why this exists

Slice 9-14 were implemented in small blocks with focused local checks. Repository rules still require a bundled smoke/contract gate after a series of blocks before treating the refactor as fully sign-off ready.

## Recommended bundled gate order

1. Focused FE regression bundle for Slice 9-14 seams:

```bash
npm --prefix frontend run test -- \
  src/components/universe/promoteReviewContract.test.js \
  src/components/universe/governanceModeContract.test.js \
  src/components/universe/recoveryModeContract.test.js \
  src/components/universe/surfaceVisualTokens.test.js \
  src/components/universe/surfaceLayoutTokens.test.js \
  src/components/universe/operatingCenterUxContract.test.js \
  src/components/universe/planetCivilizationMatrix.placeholder.test.js \
  --reporter=dot
```

2. Workspace/operator FE regression bundle:

```bash
npm --prefix frontend run test -- \
  src/components/universe/QuickGridOverlay.civilizations.test.jsx \
  src/components/universe/QuickGridOverlay.minerals.test.jsx \
  src/components/universe/WorkspaceSidebar.connectivity.test.jsx \
  --reporter=dot
```

3. Targeted staging smoke spot-check:

```bash
npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow
```

4. Contract/doc closure confirmation:

```bash
pytest -q tests/test_contract_docs_closure.py -k "canonical_ux_ontology or ux_rework_blueprint"
```

## Pass criteria

1. All commands above complete green without new snapshot/copy regressions.
2. No stale `pending focused verification` evidence remains in closure docs.
3. If any command fails, the refactor stays implementation-complete but not bundled-gate-closed.

## Recording rule

After the bundled gate runs green, copy exact command results into:
1. `docs/P1-exec/direction/ux-rework-blueprint-v1.md`
2. this file, by appending one execution snapshot section

## Focused execution snapshot

Executed during the closure review block on 2026-03-10:

1. `npm --prefix frontend run test -- src/components/universe/promoteReviewContract.test.js src/components/universe/governanceModeContract.test.js src/components/universe/recoveryModeContract.test.js src/components/universe/surfaceVisualTokens.test.js src/components/universe/surfaceLayoutTokens.test.js src/components/universe/operatingCenterUxContract.test.js --reporter=dot` -> `6 files passed, 12 tests passed`
2. `npm --prefix frontend run test -- src/components/universe/planetCivilizationMatrix.placeholder.test.js --reporter=dot` -> `1 file passed, 10 tests passed`
3. `pytest -q tests/test_contract_docs_closure.py -k "canonical_ux_ontology or ux_rework_blueprint"` -> `2 passed`
4. `npm --prefix frontend run format:check` -> green

Pending:

1. full bundled gate sequence above
2. explicit staging smoke result append after user-run confirmation
