# Planet/Civilization Operations Canonical v1

Status: active (canonical merged source)
Date: 2026-03-10
Owner: Release + FE + BE
Merged sources:
- `docs/release/v1-rollout-runbook.md` (logical-flow + runtime hardening sections)
- historical feature-flag rollout and rollback artifacts
- historical runtime-hardening sprint artifact

## 1. What changed

This document merges Planet/Civilization operational procedures into one canonical run source:
1. flag rollout phases and promotion gates,
2. rollback matrix and incident response,
3. runtime hardening operator flow (outbox/tracing/db routing/shutdown).

## 2. Why it changed

Operational actions were split across several files, increasing incident-time lookup cost. One canonical operations document reduces ambiguity during rollout and rollback.

## 3. Canonical operator flow

1. Validate release preconditions and run short gates before phase promotion.
2. Execute feature-flag phase transitions using explicit promotion criteria.
3. On incident, use targeted flag rollback first, then broader release rollback if needed.
4. For runtime issues, use outbox status/run-once endpoints and trace/correlation log checks.
5. For DB replica incidents, fallback to single-DB mode and run DB router gate.

## 4. Evidence

1. `make dev-staging-check` bundle used as primary FE staging smoke gate.
2. `PYTHONPATH=. pytest -q tests/test_api_integration.py -rs` -> `99 passed, 1 skipped` (expected skip)
3. `PYTHONPATH=. pytest -q tests/test_star_core_integration_freeze.py -rs` -> `3 passed`
4. PRH focused suites (outbox/trace/resilience/db-router) passed in closure cycle.

## 5. Remaining open items

1. [x] 2026-03-10: no blocking open items for v1 operations closure.
2. [ ] Runtime stability follow-up tracked in active runtime roadmap and release runbook notes.
