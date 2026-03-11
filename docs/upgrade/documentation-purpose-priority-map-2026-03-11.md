# Documentation Purpose/Priority Map - 2026-03-11

Status: active (canonical classification map)
Scope: all current files under `docs/` (53 files)
Owner: product + engineering

## 1. Priority ladder for purposes

`P0`:
- runtime correctness, contract truth, release gates, mandatory operating rules
- changes require high rigor and explicit evidence

`P1`:
- active direction and implementation management
- supports execution, can evolve more frequently than `P0`

`P2`:
- reference/history/context
- non-blocking for runtime and release flow

## 2. Purpose map (ordered by priority)

### Purpose A: Normative Runtime and Domain Contracts (`P0`)

- `docs/contracts/semantic-constitution-v1.md`
- `docs/contracts/canonical-ux-ontology-v1.md`
- `docs/contracts/api-v1.md`
- `docs/contracts/table-contract-v1.md`
- `docs/contracts/parser-v1.md`
- `docs/contracts/parser-v2-spec.md`
- `docs/contracts/galaxy-workspace-contract-v1.md`
- `docs/contracts/civilization-contract-v1.md`
- `docs/contracts/mineral-contract-v1.md`
- `docs/contracts/moon-contract-v1.md`
- `docs/contracts/moon-impact-contract-v1.md`
- `docs/contracts/bond-preview-validate-contract-v1.md`
- `docs/contracts/visual-builder-context-contract-v1.md`
- `docs/contracts/visual-builder-state-machine-v1.md`
- `docs/contracts/star-physics-laws-v2.md`
- `docs/contracts/planet-builder-mvp-v2.md`
- `docs/contracts/inspector-ia-contract-v1.md`
- `docs/contracts/cosmos-sprint1-openapi.yaml`

### Purpose B: Machine Baselines and Freeze Snapshots (`P0`)

- `docs/api-v1-openapi-baseline-v1.json`
- `docs/civilization-contract-baseline-v1.json`
- `docs/galaxy-workspace-contract-baseline-v1.json`
- `docs/mineral-contract-baseline-v1.json`
- `docs/moon-capability-matrix-v1.json`
- `docs/moon-contract-baseline-v1.json`
- `docs/semantic-constitution-baseline-v1.json`
- `docs/star-contract-baseline-v1.json`
- `docs/star-physics-contract-baseline-v2.json`

### Purpose C: Release Gates and Operations Control (`P0`)

- `docs/release/backend-quality-gate.md`
- `docs/release/v1-freeze-checklist.md`
- `docs/release/v1-rollout-runbook.md`
- `docs/release/planet-civilization-operations-canonical-v1.md`
- `docs/contracts/contract-gap-diff-v2.md`
- `docs/upgrade/human-agent-alignment-protocol-v1.md`

### Purpose D: Product and UX Direction (`P1`)

- `docs/ARCHITECTURE_DIRECTION_V1.md`
- `docs/FRONTEND_UX_ARCHITECTURE.md`
- `docs/contracts/ux-rework-blueprint-v1.md`
- `docs/contracts/planet-civilization-domain-canonical-v1.md`
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`

### Purpose E: Active Implementation and Delivery Management (`P1`)

- `docs/contracts/backend-legacy-cleanup-sprint-v1.md`
- `docs/upgrade/backend-sprint-dod-checklist.md`
- `docs/upgrade/planet-civilization-implementation-plan-v1.md`
- `docs/upgrade/service-maturity-matrix-v1.md`
- `docs/upgrade/ux-refactor-bundled-gate-plan-2026-03-10.md`
- `docs/upgrade/documentation-triage-2026-03-11.md`

### Purpose F: Process and Agent Editing Rules (`P1`)

- `docs/contracts/AGENTS.md`

### Purpose G: Historical, ADR and General Reference (`P2`)

- `docs/dod-system-mvp-v2.md`
- `docs/domain_units.md`
- `docs/effective_usage_seed.md`
- `docs/release/v1-release-notes.md`
- `docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`
- `docs/upgrade/adr-star-physics-laws-v2.md`
- `docs/upgrade/codex-agent-workflow-setup-v1.md`
- `docs/upgrade/v1.md`

## 3. Operating rule from this map

1. New docs must declare purpose and target priority (`P0/P1/P2`) in header.
2. If a `P2` artifact becomes operationally required by tests/scripts/runbook, reclassify it to `P1` or `P0`.
3. If a `P1` artifact is fully merged into a canonical `P0` doc, move it to archive in the next cleanup block.
