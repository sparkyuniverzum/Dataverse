# Session Handoff - 2026-03-08

## Stav
- FE/BE gate je zelený podle posledního běhu.
- `prettier` byl opraven; `format:check` prochází.
- Větev je připravená na navázání bez dalších hotfixů.

## Co je hotové dnes
- Backend:
  - Ztenčení router logiky a přesun orchestrace do service helperů.
  - Zavedení shared flow pro scoped atomic/idempotent execution.
- Frontend:
  - Rozřezání `UniverseWorkspace` monolitu o command bar controller:
    - `frontend/src/components/universe/useCommandBarController.js`
  - Rozřezání moon CRUD logiky:
    - `frontend/src/components/universe/useMoonCrudController.js`
  - Rozřezání bond draft + preview/commit logiky:
    - `frontend/src/components/universe/useBondDraftController.js`
  - `UniverseWorkspace.jsx` přepojen na nové hooky.

## Poslední ověřené test/gate snapshot
- `pre-commit`: passed
- `npm --prefix frontend run test -- --run ...`:
  - 3 files, 26 tests passed
- `npm --prefix frontend run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`:
  - 1 test passed
- `npm --prefix frontend run format:check`:
  - all matched files use Prettier code style

## Kde navázat zítra (priorita)
1. Rozpad StageZero logiky z `UniverseWorkspace.jsx` do `useStageZeroController`.
2. Vytáhnout StageZero UI do prezentačních komponent:
   - `StageZeroStarLockGate`
   - `StageZeroIntroGate`
   - `StageZeroBlueprintPanel`
   - `StageZeroSetupPanel`
3. Po každém řezu držet stejné FE gate:
   - `UniverseWorkspace.contextMenu.test.jsx`
   - `WorkspaceSidebar.moonImpact.test.jsx`
   - `planetCivilizationMatrix.placeholder.test.js`
   - `e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs`

## Poznámka pro navázání
- Aider zůstává jen pro testy/docs.
- Implementace změn v kódu dělám přímo já.
