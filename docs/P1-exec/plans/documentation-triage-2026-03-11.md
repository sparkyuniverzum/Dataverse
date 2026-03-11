# Documentation Triage - 2026-03-11

Status: closed (cleanup executed + references rewired)
Scope: `docs/` (49 active files + historical removed-set log)
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

## Aktualni (49)

- `docs/README.md`
- `docs/P0-core/README.md`
- `docs/P0-core/baselines/api-v1-openapi-baseline-v1.json`
- `docs/P0-core/baselines/civilization-contract-baseline-v1.json`
- `docs/P0-core/baselines/galaxy-workspace-contract-baseline-v1.json`
- `docs/P0-core/baselines/mineral-contract-baseline-v1.json`
- `docs/P0-core/baselines/moon-capability-matrix-v1.json`
- `docs/P0-core/baselines/moon-contract-baseline-v1.json`
- `docs/P0-core/baselines/semantic-constitution-baseline-v1.json`
- `docs/P0-core/baselines/star-contract-baseline-v1.json`
- `docs/P0-core/baselines/star-physics-contract-baseline-v2.json`
- `docs/P0-core/contracts/AGENTS.md`
- `docs/P0-core/contracts/api-v1.md`
- `docs/P0-core/contracts/bond-preview-validate-contract-v1.md`
- `docs/P0-core/contracts/canonical-ux-ontology-v1.md`
- `docs/P0-core/contracts/civilization-contract-v1.md`
- `docs/P0-core/contracts/contract-gap-diff-v2.md`
- `docs/P0-core/contracts/cosmos-sprint1-openapi.yaml`
- `docs/P0-core/contracts/galaxy-workspace-contract-v1.md`
- `docs/P0-core/contracts/inspector-ia-contract-v1.md`
- `docs/P0-core/contracts/mineral-contract-v1.md`
- `docs/P0-core/contracts/moon-contract-v1.md`
- `docs/P0-core/contracts/moon-impact-contract-v1.md`
- `docs/P0-core/contracts/parser-v1.md`
- `docs/P0-core/contracts/parser-v2-spec.md`
- `docs/P0-core/contracts/planet-builder-mvp-v2.md`
- `docs/P0-core/contracts/semantic-constitution-v1.md`
- `docs/P0-core/contracts/star-physics-laws-v2.md`
- `docs/P0-core/contracts/table-contract-v1.md`
- `docs/P0-core/contracts/visual-builder-context-contract-v1.md`
- `docs/P0-core/contracts/visual-builder-state-machine-v1.md`
- `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`
- `docs/P0-core/release/backend-quality-gate.md`
- `docs/P0-core/release/planet-civilization-operations-canonical-v1.md`
- `docs/P0-core/release/v1-freeze-checklist.md`
- `docs/P0-core/release/v1-rollout-runbook.md`
- `docs/P1-exec/README.md`
- `docs/P1-exec/direction/ARCHITECTURE_DIRECTION_V1.md`
- `docs/P1-exec/direction/FRONTEND_UX_ARCHITECTURE.md`
- `docs/P1-exec/direction/planet-civilization-delivery-canonical-v1.md`
- `docs/P1-exec/direction/planet-civilization-domain-canonical-v1.md`
- `docs/P1-exec/direction/ux-rework-blueprint-v1.md`
- `docs/P1-exec/plans/backend-legacy-cleanup-sprint-v1.md`
- `docs/P1-exec/plans/backend-sprint-dod-checklist.md`
- `docs/P1-exec/plans/documentation-purpose-priority-map-2026-03-11.md`
- `docs/P1-exec/plans/documentation-triage-2026-03-11.md`
- `docs/P1-exec/plans/planet-civilization-implementation-plan-v1.md`
- `docs/P1-exec/plans/service-maturity-matrix-v1.md`
- `docs/P1-exec/plans/ux-refactor-bundled-gate-plan-2026-03-10.md`

## Historical Removed Set (37)

- `removed: contracts/civilization-mineral-contract-v2.md`
- `removed: contracts/contract-gate-plan-v2.md`
- `removed: contracts/p2-test-stability-report-2026-03-10.md`
- `removed: contracts/planet-builder-ux-flow-p3-backlog-v1.md`
- `removed: contracts/planet-builder-ux-flow-p4-backlog-v1.md`
- `removed: contracts/planet-builder-ux-flow-p5-backlog-v1.md`
- `removed: contracts/planet-civilization-glossary-v1.md`
- `removed: contracts/planet-civilization-logical-flow-dod-v1.md`
- `removed: contracts/planet-civilization-logical-flow-wave0-execution-v1.md`
- `removed: contracts/planet-civilization-moon-mineral-workflow-v1.md`
- `removed: contracts/planet-civilization-runtime-stability-sprint-v2.md`
- `removed: contracts/planet-civilization-telemetry-v1.md`
- `removed: contracts/planet-civilization-test-matrix-v1.md`
- `removed: contracts/planet-civilization-ui-workflow-audit-v2.md`
- `removed: contracts/planet-civilization-ui-workflow-sprint-plan-v1.md`
- `removed: contracts/planet-civilization-ux-intent-v1.md`
- `removed: contracts/planet-moon-dod-v3.md`
- `removed: contracts/planet-moon-p1-backlog-v1.md`
- `removed: contracts/planet-moon-preview-layer-p6-backlog-v1.md`
- `removed: contracts/platform-runtime-hardening-sprint-plan-v1.md`
- `removed: release/planet-civilization-feature-flag-rollout-v1.md`
- `removed: release/planet-civilization-logical-flow-rollback-v1.md`
- `removed: star-contract-audit.md`
- `removed: upgrade/calc-physics-engine-stages.md`
- `removed: upgrade/service-parity-audit-2026-03-03.md`
- `removed: upgrade/session-handoff-2026-03-08.md`
- `removed: upgrade/session-handoff-2026-03-10-prh3-prh4.md`
- `removed: upgrade/session-handoff-2026-03-10-slice9.md`
- `removed: P2-ref/README.md`
- `removed: P2-ref/adr/adr-moon-civilization-runtime-alias-migration-v1.md`
- `removed: P2-ref/adr/adr-star-physics-laws-v2.md`
- `removed: P2-ref/reference/codex-agent-workflow-setup-v1.md`
- `removed: P2-ref/reference/dod-system-mvp-v2.md`
- `removed: P2-ref/reference/domain_units.md`
- `removed: P2-ref/reference/effective_usage_seed.md`
- `removed: P2-ref/reference/v1-release-notes.md`
- `removed: P2-ref/reference/v1.md`

## Notes

1. Cleanup is already executed: active documents are in `P0-core` and `P1-exec`.
2. The historical removed set above is informational only and intentionally non-resolvable.
