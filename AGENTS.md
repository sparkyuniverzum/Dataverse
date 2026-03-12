# Dataverse Agent Rules

Scope: entire repository.

## Mandatory First Step On Every Context Load

1. Read this file first.
2. Read the nearest local `AGENTS.md` in the subdirectory you are working in.
3. Continue only after both rule files are loaded.

## Core Working Rules

1. Keep changes small and explicit; avoid hidden side effects.
2. Do not expand monolith files without clear need; prefer focused helpers and adapters.
3. Monolith creation is prohibited: do not introduce new oversized all-in-one files/components/modules.
4. When logic grows, split by responsibility into small composable units (helpers/hooks/services).
5. For flaky tests, stabilize logic first, then assertions.
6. Keep FE/BE terminology aligned: `civilization` is canonical row entity, `moon` is capability over table/planet; new `asteroid*` terminology is forbidden.
7. Keep workflow logs operator-readable and chronologically consistent.

## Documentation Language Policy (Mandatory)

1. Canonical language for active project documentation (`docs/*`) is Czech (`CZ`).
2. Do not maintain parallel active EN+CZ copies of the same document unless explicitly requested for external delivery.
3. Source code, API paths, error codes, telemetry keys/event names, and DB schema/table/column names must remain in English.
4. In Czech documentation, keep technical identifiers in original English form and format them as code (for example: `/civilizations*`, `event_seq`).
5. If EN mirrors are kept for history, store them under explicit archive paths (for example `docs/P0-core/contracts/archive/en/`) and do not list them as active references.

## UI Copy Policy (Mandatory)

1. User-visible UI text must be Czech and user-friendly by default.
2. UI copy must use canonical terminology consistently:
   - `civilizace` = row runtime entity,
   - `měsíc` = capability over planeta/tabulka,
   - `vazba`, `minerál`, `větev`, `srdce hvězdy` per ontology.
3. If a term can be misunderstood, UI text must include a short clarifier (for example: `Měsíc (capability)`).
4. Technical identifiers in UI that map to backend/runtime (`API path`, `error code`, `telemetry key`, `DB name`) remain in English.
5. If this policy is not in current implementation scope, record it as pending and do not ship contradictory new UI text.

## API Terminology Baseline (Mandatory)

1. Canonical row lifecycle CRUD/mutation surface is `/civilizations*`.
2. Moon capability is a first-class domain over table/planet (`/planets/{planet_id}/capabilities`, moon summaries/dashboard views).
3. Historical naming note: `moon` was used in the past for row semantics, but this is obsolete. Current runtime truth is `civilization = row` and `moon = capability`.
4. `/moons*` row runtime/API surface is removed; do not restore it. If a legacy test/doc still references row `/moons*`, migrate it to `/civilizations*`.
5. `/asteroids*` is removed API surface; do not reintroduce it in runtime, docs, or new tests.
6. New module/function/variable naming must use `civilization` (row) and `moon` (capability/UX), never `asteroid`.

## Absolute No-Shortcut Rule (Mandatory)

1. Quick-fix shortcuts are strictly forbidden.
2. Never introduce temporary parallel runtime paths to "unblock tests" or "patch behavior fast".
3. Never bypass canonical contracts, OCC, validation, or domain boundaries as a workaround.
4. If canonical fix is not ready inside the current block, stop and report blockers/options instead of shipping a shortcut.
5. Any intentional workaround requires explicit user approval before implementation.

## Collaboration Contract (Mandatory)

1. Work in implementation blocks.
2. Agent handles: analysis, implementation, local logic checks, and a concise change summary.
3. User handles: running requested tests and performing git commit.
4. After every block, agent must provide `Povel pro tebe` with exact copy/paste commands.
5. Do not claim block completion without an explicit command list for user execution.
6. For UX-first, refactor, or product-experience work, load and follow `docs/P0-core/governance/fe-collaboration-single-source-of-truth-v2CZ.md` before claiming scope, success, or closure.
7. Po FE resetu je zavazny postup `priprava -> navrh -> implementace`; agent nesmi preskocit pripravu a jit rovnou do kodu.
8. Pri praci nad FE archivem musi nejdriv probehnout porada nad `frontend/src/_inspiration_reset_20260312/` se zapisem `OK / NOK / proc / co prevzit / co odstranit`.
9. `NOK` polozky z FE archivu se po schvalene davce odstranuji definitivne z projektu; agent je nesmi nechavat dlouhodobe lezet bez rozhodnuti.
10. Kazda FE archivni davka musi byt podlozena dukazy odpovidajicimi scope: screenshoty, focused testy a strucne auditni rozhodnuti.
11. Kazdy navazujici FE implementacni dokument po resetu musi obsahovat sekci `Pripraveny kod z archivu` s odkazem na aktivni reuse mapu a s vyctem helperu/controlleru, ktere se v danem bloku skutecne pouziji.

## Test Cadence (Mandatory)

1. Per implementation block: run only focused/unit or narrow-scope tests relevant to changed files.
2. Do not request the full long-running staging e2e suite after every single block.
3. Run long staging smokes as a bundled gate after a series of blocks, or before merge/release.
4. If a block touches workspace entry/grid orchestration, include at most one targeted staging smoke as a spot-check.

## Fast Navigation

1. Frontend runtime universe: `frontend/src/components/universe/`
2. Staging e2e flows: `frontend/e2e/staging/`
3. Backend API/runtime: `app/`
4. Integration and regression tests: `tests/`
5. Contracts and rollout docs: `docs/P0-core/contracts/`, `docs/P0-core/release/`

## Validation Baseline

1. `npm --prefix frontend run format:check`
2. `npm --prefix frontend run test -- src/App.test.jsx src/components/app/AppConnectivityNotice.test.jsx src/components/app/appConnectivityNoticeState.test.js src/components/app/WorkspaceShell.test.jsx src/components/universe/UniverseWorkspace.test.jsx`
3. `npm --prefix frontend run build`
4. `pytest -q tests/test_api_integration.py` (release/hardening gate)
