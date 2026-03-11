# Documentation Triage - 2026-03-11

Status: active (audit snapshot for cleanup execution)
Scope: `docs/` (80 files)
Owner: agent + user

## Rule set used

1. `Aktualni`
- canonical/frozen/active docs
- docs hard-referenced by tests/scripts/runtime
- current runbooks and baselines needed for gates

2. `Odpad/archiv`
- documents explicitly marked `archived` or `closed`
- handoff-only session notes
- historical backlog/audit artifacts superseded by canonical docs

## Aktualni (52)

- `docs/ARCHITECTURE_DIRECTION_V1.md`
- `docs/FRONTEND_UX_ARCHITECTURE.md`
- `docs/api-v1-openapi-baseline-v1.json`
- `docs/civilization-contract-baseline-v1.json`
- `docs/contracts/AGENTS.md`
- `docs/contracts/api-v1.md`
- `docs/contracts/backend-legacy-cleanup-sprint-v1.md`
- `docs/contracts/bond-preview-validate-contract-v1.md`
- `docs/contracts/canonical-ux-ontology-v1.md`
- `docs/contracts/civilization-contract-v1.md`
- `docs/contracts/contract-gap-diff-v2.md`
- `docs/contracts/cosmos-sprint1-openapi.yaml`
- `docs/contracts/galaxy-workspace-contract-v1.md`
- `docs/contracts/inspector-ia-contract-v1.md`
- `docs/contracts/mineral-contract-v1.md`
- `docs/contracts/moon-contract-v1.md`
- `docs/contracts/moon-impact-contract-v1.md`
- `docs/contracts/parser-v1.md`
- `docs/contracts/parser-v2-spec.md`
- `docs/contracts/planet-builder-mvp-v2.md`
- `docs/contracts/planet-civilization-delivery-canonical-v1.md`
- `docs/contracts/planet-civilization-domain-canonical-v1.md`
- `docs/contracts/semantic-constitution-v1.md`
- `docs/contracts/star-physics-laws-v2.md`
- `docs/contracts/table-contract-v1.md`
- `docs/contracts/ux-rework-blueprint-v1.md`
- `docs/contracts/visual-builder-context-contract-v1.md`
- `docs/contracts/visual-builder-state-machine-v1.md`
- `docs/dod-system-mvp-v2.md`
- `docs/domain_units.md`
- `docs/effective_usage_seed.md`
- `docs/galaxy-workspace-contract-baseline-v1.json`
- `docs/mineral-contract-baseline-v1.json`
- `docs/moon-capability-matrix-v1.json`
- `docs/moon-contract-baseline-v1.json`
- `docs/release/backend-quality-gate.md`
- `docs/release/planet-civilization-operations-canonical-v1.md`
- `docs/release/v1-freeze-checklist.md`
- `docs/release/v1-release-notes.md`
- `docs/release/v1-rollout-runbook.md`
- `docs/semantic-constitution-baseline-v1.json`
- `docs/star-contract-baseline-v1.json`
- `docs/star-physics-contract-baseline-v2.json`
- `docs/upgrade/adr-moon-civilization-runtime-alias-migration-v1.md`
- `docs/upgrade/adr-star-physics-laws-v2.md`
- `docs/upgrade/backend-sprint-dod-checklist.md`
- `docs/upgrade/codex-agent-workflow-setup-v1.md`
- `docs/upgrade/human-agent-alignment-protocol-v1.md`
- `docs/upgrade/planet-civilization-implementation-plan-v1.md`
- `docs/upgrade/service-maturity-matrix-v1.md`
- `docs/upgrade/ux-refactor-bundled-gate-plan-2026-03-10.md`
- `docs/upgrade/v1.md`

## Odpad/archiv (28)

- `docs/contracts/civilization-mineral-contract-v2.md`
- `docs/contracts/contract-gate-plan-v2.md`
- `docs/contracts/p2-test-stability-report-2026-03-10.md`
- `docs/contracts/planet-builder-ux-flow-p3-backlog-v1.md`
- `docs/contracts/planet-builder-ux-flow-p4-backlog-v1.md`
- `docs/contracts/planet-builder-ux-flow-p5-backlog-v1.md`
- `docs/contracts/planet-civilization-glossary-v1.md`
- `docs/contracts/planet-civilization-logical-flow-dod-v1.md`
- `docs/contracts/planet-civilization-logical-flow-wave0-execution-v1.md`
- `docs/contracts/planet-civilization-moon-mineral-workflow-v1.md`
- `docs/contracts/planet-civilization-runtime-stability-sprint-v2.md`
- `docs/contracts/planet-civilization-telemetry-v1.md`
- `docs/contracts/planet-civilization-test-matrix-v1.md`
- `docs/contracts/planet-civilization-ui-workflow-audit-v2.md`
- `docs/contracts/planet-civilization-ui-workflow-sprint-plan-v1.md`
- `docs/contracts/planet-civilization-ux-intent-v1.md`
- `docs/contracts/planet-moon-dod-v3.md`
- `docs/contracts/planet-moon-p1-backlog-v1.md`
- `docs/contracts/planet-moon-preview-layer-p6-backlog-v1.md`
- `docs/contracts/platform-runtime-hardening-sprint-plan-v1.md`
- `docs/release/planet-civilization-feature-flag-rollout-v1.md`
- `docs/release/planet-civilization-logical-flow-rollback-v1.md`
- `docs/star-contract-audit.md`
- `docs/upgrade/calc-physics-engine-stages.md`
- `docs/upgrade/service-parity-audit-2026-03-03.md`
- `docs/upgrade/session-handoff-2026-03-08.md`
- `docs/upgrade/session-handoff-2026-03-10-prh3-prh4.md`
- `docs/upgrade/session-handoff-2026-03-10-slice9.md`

## Notes

1. This split does not delete anything yet; it defines canonical keep/remove sets.
2. For safe cleanup, move `Odpad/archiv` files to a dedicated archive folder in one commit, then rerun docs-related gates.
