# Codex Agent Workflow Setup v1

Date: 2026-03-10
Owner: FE/BE collaboration

## 1. Goal

Standardize local terminal + Codex CLI workflow so implementation/test/commit loops are fast and deterministic.

## 2. One-time setup

1. From repo root:
   - `./scripts/dev_agent_setup.sh --apply`
2. Reload shell:
   - `source ~/.bashrc`
3. Verify:
   - `dv`
   - `dvg`
   - `dvfast`

## 3. Daily command set

1. Quick state:
   - `dvg` (`git status --short`)
   - `dwd` (`git diff --stat`)
2. Fast FE gate:
   - `dvfast` (same as `./scripts/dev_fast_check.sh unit`)
3. Staging e2e gate:
   - `dve2e` (same as `./scripts/dev_fast_check.sh staging`)
4. Full release-like gate:
   - `./scripts/dev_fast_check.sh full`

Staging wrappers (canonical, repo-standard):
1. `./scripts/staging_workspace_starlock_wizard_grid_smoke.sh`
2. `./scripts/staging_planet_civilization_mineral_workflow_smoke.sh`
3. `./scripts/staging_planet_civilization_lf_matrix_smoke.sh`
4. `./scripts/staging_planet_moon_preview_smoke.sh`

## 4. Codex slash commands (recommended)

1. `/diff` before every test/commit block.
2. `/compact` when context is long.
3. `/review` before final commit.
4. `/status` if latency/limits are suspicious.
5. `/fork` when trying risky changes.

## 5. Collaboration contract

1. Agent implements and runs targeted local checks.
2. User runs final gate commands and creates commit.
3. No monolith expansion; prefer small helper modules.
4. Every block ends with:
   - changed files,
   - exact commands to run,
   - done vs remaining items.

## 6. Canonical gate commands

1. FE targeted (unit/component):
   - `npm --prefix frontend run test -- src/components/universe/civilizationInspectorModel.test.js src/components/universe/WorkspaceSidebar.moonImpact.test.jsx src/components/universe/QuickGridOverlay.minerals.test.jsx src/components/universe/QuickGridOverlay.civilizations.test.jsx src/lib/archiveWorkflowGuard.test.js`
2. FE staging (prefer wrappers):
   - `./scripts/staging_workspace_starlock_wizard_grid_smoke.sh`
   - `./scripts/staging_planet_civilization_mineral_workflow_smoke.sh`
   - `./scripts/staging_planet_civilization_lf_matrix_smoke.sh`
   - `./scripts/staging_planet_moon_preview_smoke.sh`
3. BE integration:
   - `PYTHONPATH=. pytest -q tests/test_api_integration.py`
