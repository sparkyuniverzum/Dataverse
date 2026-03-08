# Galaxy Workspace Contract v1

Status: frozen (MVP sign-off)
Date: 2026-03-05
Depends on: `docs/contracts/api-v1.md`, `docs/contracts/semantic-constitution-v1.md`

## 1. Purpose

Define Galaxy as first-class Workspace boundary for tenant-scoped data operations.

Galaxy is the top scope for:
- Star laws
- Planet lifecycle
- Civilization data
- Branch timelines

## 2. Identity and scope

Galaxy identity:
- `galaxy_id: uuid`
- owner: `user_id` (single owner in current MVP model)

All domain reads/writes must resolve to one active galaxy scope.

## 3. Invariants

1. User cannot access foreign galaxy (`403`).
2. Soft delete only for galaxy lifecycle (`deleted_at`), no hard delete route.
3. Every domain operation is resolved in `user_id + galaxy_id (+ optional branch_id)`.
4. On galaxy create, onboarding progress record must be initialized.
5. Main timeline and branch timelines are isolated by scope resolution rules.

## 4. API surface (workspace layer)

### 4.1 Galaxy core

- `GET /galaxies`
- `POST /galaxies`
- `PATCH /galaxies/{galaxy_id}/extinguish`

### 4.2 Branch workspace timelines

- `GET /branches` (query: `galaxy_id?`)
- `POST /branches`
- `POST /branches/{branch_id}/promote`

### 4.3 Workspace onboarding state

- `GET /galaxies/{galaxy_id}/onboarding`
- `PATCH /galaxies/{galaxy_id}/onboarding`

## 5. Branch semantics

1. Branch belongs to one galaxy.
2. Branch name is unique among active branches in one galaxy.
3. Promote replays branch events to main timeline and closes branch.
4. Branch operations must respect galaxy ownership and access checks.

## 6. Error model

Expected status classes:
- `401`: auth/session invalid
- `403`: foreign galaxy/branch access
- `404`: galaxy/branch not found or deleted
- `409`: promotion/conflict conditions where applicable

## 7. DoD for this contract

1. Galaxy lifecycle endpoints remain backward compatible with API v1.
2. Branch lifecycle works without cross-galaxy leakage.
3. Onboarding state is available per galaxy immediately after create.
4. Integration tests cover foreign access denial and branch promote flow.
