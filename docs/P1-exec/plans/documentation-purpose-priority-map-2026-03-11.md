# Documentation Purpose/Priority Map - 2026-03-11

Status: active (canonical classification map)
Scope: all current files under `docs/` (49 files)
Owner: product + engineering

## 1. Visual system

Priority labels:
- `[P0-CORE]` = runtime truth, gates, mandatory rules
- `[P1-EXEC]` = active execution and steering docs

Purpose labels:
- `[A]` Normative contracts
- `[B]` Machine baselines
- `[C]` Release and operations control
- `[D]` Product/UX direction
- `[E]` Active implementation management
- `[F]` Process/agent rules

## 2. Dashboard

| Priority | Meaning | Count | Share |
|---|---|---:|---:|
| `[P0-CORE]` | runtime truth + gates | 33 | 67% |
| `[P1-EXEC]` | active execution docs | 16 | 33% |
| **Total** |  | **49** | **100%** |

## 3. Purpose map (ordered by priority)

### `[P0-CORE][A]` Normative Runtime and Domain Contracts (18)

- `docs/P0-core/contracts/semantic-constitution-v1.md`
- `docs/P0-core/contracts/canonical-ux-ontology-v1.md`
- `docs/P0-core/contracts/api-v1.md`
- `docs/P0-core/contracts/table-contract-v1.md`
- `docs/P0-core/contracts/parser-v1.md`
- `docs/P0-core/contracts/parser-v2-spec.md`
- `docs/P0-core/contracts/galaxy-workspace-contract-v1.md`
- `docs/P0-core/contracts/civilization-contract-v1.md`
- `docs/P0-core/contracts/mineral-contract-v1.md`
- `docs/P0-core/contracts/moon-contract-v1.md`
- `docs/P0-core/contracts/moon-impact-contract-v1.md`
- `docs/P0-core/contracts/bond-preview-validate-contract-v1.md`
- `docs/P0-core/contracts/visual-builder-context-contract-v1.md`
- `docs/P0-core/contracts/visual-builder-state-machine-v1.md`
- `docs/P0-core/contracts/star-physics-laws-v2.md`
- `docs/P0-core/contracts/planet-builder-mvp-v2.md`
- `docs/P0-core/contracts/inspector-ia-contract-v1.md`
- `docs/P0-core/contracts/cosmos-sprint1-openapi.yaml`

### `[P0-CORE][B]` Machine Baselines and Freeze Snapshots (9)

- `docs/P0-core/baselines/api-v1-openapi-baseline-v1.json`
- `docs/P0-core/baselines/civilization-contract-baseline-v1.json`
- `docs/P0-core/baselines/galaxy-workspace-contract-baseline-v1.json`
- `docs/P0-core/baselines/mineral-contract-baseline-v1.json`
- `docs/P0-core/baselines/moon-capability-matrix-v1.json`
- `docs/P0-core/baselines/moon-contract-baseline-v1.json`
- `docs/P0-core/baselines/semantic-constitution-baseline-v1.json`
- `docs/P0-core/baselines/star-contract-baseline-v1.json`
- `docs/P0-core/baselines/star-physics-contract-baseline-v2.json`

### `[P0-CORE][C]` Release Gates and Operations Control (6)

- `docs/P0-core/release/backend-quality-gate.md`
- `docs/P0-core/release/v1-freeze-checklist.md`
- `docs/P0-core/release/v1-rollout-runbook.md`
- `docs/P0-core/release/planet-civilization-operations-canonical-v1.md`
- `docs/P0-core/contracts/contract-gap-diff-v2.md`
- `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`

### `[P1-EXEC][D]` Product and UX Direction (5)

- `docs/P1-exec/direction/ARCHITECTURE_DIRECTION_V1.md`
- `docs/P1-exec/direction/FRONTEND_UX_ARCHITECTURE.md`
- `docs/P1-exec/direction/ux-rework-blueprint-v1.md`
- `docs/P1-exec/direction/planet-civilization-domain-canonical-v1.md`
- `docs/P1-exec/direction/planet-civilization-delivery-canonical-v1.md`

### `[P1-EXEC][E]` Active Implementation and Delivery Management (7)

- `docs/P1-exec/plans/backend-legacy-cleanup-sprint-v1.md`
- `docs/P1-exec/plans/backend-sprint-dod-checklist.md`
- `docs/P1-exec/plans/planet-civilization-implementation-plan-v1.md`
- `docs/P1-exec/plans/service-maturity-matrix-v1.md`
- `docs/P1-exec/plans/ux-refactor-bundled-gate-plan-2026-03-10.md`
- `docs/P1-exec/plans/documentation-triage-2026-03-11.md`
- `docs/P1-exec/plans/documentation-purpose-priority-map-2026-03-11.md`

### `[P1-EXEC][F]` Process and Agent Editing Rules (4)

- `docs/P0-core/contracts/AGENTS.md`
- `docs/README.md`
- `docs/P0-core/README.md`
- `docs/P1-exec/README.md`

## 4. Operating rule from this map

1. New docs must declare purpose and target priority (`P0/P1`) in header.
2. If an artifact becomes operationally required by tests/scripts/runbook, keep it in `P0` or `P1`.
3. If a `P1` artifact is fully merged into a canonical `P0` doc, move it to archive in the next cleanup block.
