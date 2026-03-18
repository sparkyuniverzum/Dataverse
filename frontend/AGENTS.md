# FE workspace rules

Scope: `/mnt/c/Projekty/Dataverse/frontend`

## Co je povoleno a co ne

- Code změny dělej pouze ve `frontend/`.
- Backend kód neupravuj (cokoliv mimo `frontend/`, typicky `../app`, `../alembic`, `../scripts`, atd.).
- Čtení kanonických kontraktů v `../docs/**` je povinné pro FE práci (viz root `/mnt/c/Projekty/Dataverse/AGENTS.md`).

## Pracovní standard

- Preferuj malé, bezpečné změny.
- Před editací stručně popiš plán.
- Po změnách spusť relevantní gate: `npm run lint`, `npm run test`, `npm run build`.

## Baseline režim

- FE pravda o BE surface je v packetu `../docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md`.
- Pokud FE začne používat nové BE pole/endpoint, nejdřív aktualizuj packet (ne “tichý” workaround ve FE).
