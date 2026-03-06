# Planet Builder UX Flow P5 Backlog v1

Status: active
Date: 2026-03-06
Depends on: `docs/contracts/planet-moon-dod-v3.md`, `docs/contracts/planet-builder-ux-flow-p4-backlog-v1.md`

## 1. Goal

Move smoke validation from local harness routes toward real staging app flow:
- real auth bootstrap,
- real auth/session lifecycle,
- then workspace/star-lock/wizard/grid convergence.

## 2. Priority order

1. `PM-P5-01` Auth bootstrap helper for browser smoke.
2. `PM-P5-02` Real auth/session lifecycle smoke.
3. `PM-P5-03` Real workspace bootstrap smoke.
4. `PM-P5-04` Real star-lock + first-planet wizard + grid convergence smoke.

Current state:
- `PM-P5-01`: closed.
- `PM-P5-02`: closed.
- `PM-P5-03`: open.
- `PM-P5-04`: open.

## 3. Scope items

### 3.1 PM-P5-01 Auth bootstrap helper

DoD:
1. Deterministic user credentials resolver for smoke runs.
2. Register-first with login fallback behavior.
3. Reusable helper module for multiple staging specs.

Gate:
- `frontend/e2e/staging/auth-bootstrap.mjs`

### 3.2 PM-P5-02 Real auth/session lifecycle smoke

DoD:
1. Browser test executes login on real app route.
2. Test verifies `/auth/me`, `/auth/refresh`, and browser token update.
3. Logout from UI clears local session.

Gate:
- `frontend/e2e/staging/auth-session-real.smoke.spec.mjs`

### 3.3 PM-P5-03 Workspace bootstrap smoke

DoD:
1. Browser smoke validates galaxy selection/create entry path.
2. Smoke remains deterministic for first-run and rerun state.
3. Validation works with real staging API.

### 3.4 PM-P5-04 Full real mission smoke

DoD:
1. Browser smoke validates star lock -> first planet wizard -> grid convergence.
2. No harness route for primary path.
3. Smoke promoted as staging release gate.
