# Backend Quality Gate

Date: 2026-03-04
Owner: BE

## Goal

Define one repeatable go/no-go gate so backend quality stays at parser-level rigor (deterministic semantics, stable contracts, no hard-delete regressions).

## Commands

- Quick gate (local before commit):
  - `make be-gate`
  - same as: `make be-gate-quick`
- Strict gate (before merge/release, requires running API):
  - `make be-gate-strict`

## Profiles

### `quick`

Runs:
- v1 safety policy (`scripts/release_v1_gate.sh`)
- compile check for all tracked Python files
- parser2 suite (`lexer/ast/planner/bridge/resolver/runtime/spec`)
- task executor + schema + IO error model tests
- calc/physics/projection/read-model tests
- auth/scope parity tests

### `strict`

Runs everything from `quick`, plus:
- API health check on `DATAVERSE_API_BASE` (default `http://127.0.0.1:8000`)
- full `tests/test_api_integration.py`

## Merge policy

- No backend PR should be merged if `make be-gate` fails.
- Changes touching API contracts, parser/executor path, or import semantics require `make be-gate-strict` green before release branch merge.

## Notes

- To target non-default API endpoint in strict profile:
  - `DATAVERSE_API_BASE=http://127.0.0.1:8001 make be-gate-strict`
