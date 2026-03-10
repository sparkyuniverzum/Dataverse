# Tests Agent Guide

Scope: `tests/`

## Mandatory Rule Load

1. Read `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Read this file.
3. Then add or adjust tests.
4. Follow root `Collaboration Contract (Mandatory)` for block handoff and `Povel pro tebe`.

## Local Priorities

1. Prefer precise failure reasons over broad assertions.
2. Keep release-gate tests deterministic and isolated.
3. For integration failures, capture API detail payload and expected transition state.

## Canonical Backend Gate

1. `pytest -q tests/test_api_integration.py`
2. Use `-k` subsets for focused debugging, but close with full gate for release hardening.
