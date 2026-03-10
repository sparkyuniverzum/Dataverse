# Staging E2E Conventions

## Scope

- This folder contains staging Playwright smoke flows for real auth + real workspace behavior.
- Prefer deterministic state assertions over copy-sensitive text assertions.

## Required helper usage

- Use `assertFeedbackOk(page, /.../, context)` after every write-like operation:
  - civilization create/update/archive
  - mineral write/remove
  - composer apply actions
- `assertFeedbackOk` fails fast on:
  - contract violations
  - unique conflicts
  - generic validation failures
- Use `selectGridRowByValue(page, value)` instead of direct `row.click()` to avoid viewport flakiness.

## Anti-patterns

- Do not rely on exact feedback copy (`toContainText("archiv")` etc.).
- Do not rely only on final row-count assertions for write success.
- Do not use lifecycle-reserved mineral keys (`state`) in mineral-write scenarios.

## Recommended smoke commands

- Full flow:
  - `npm --prefix frontend run test:e2e:planet-civilization-mineral-workflow`
- Short-path (no stage0 bootstrap, requires already converged workspace):
  - `npm --prefix frontend run test:e2e:planet-civilization-mineral-quickpath`
