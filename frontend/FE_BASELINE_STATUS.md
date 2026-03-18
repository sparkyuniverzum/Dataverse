# FE Baseline Status (Frontend)

Datum: 2026-03-16
Repo: `/mnt/c/Projekty/Dataverse` (branch `staging`, HEAD `db5e437`)

## Gate stav (lokalne)

- `npm run test`: PASS (63/63)
- `npm run lint`: PASS
- `npm run build`: PASS (vite warning: bundle > 500 kB)

## Aktivni FE runtime (co je dnes “realne v appce”)

- Auth bootstrap: tokeny v localStorage, `GET /auth/me`, default galaxy z `GET /galaxies`.
- Workspace shell: `UniverseWorkspace` jako minimalni Galaxy Space + Star Core interior jako standalone obrazovka.
- Aktivni read surface v workspace: Star Core policy/physics/interior + telemetry + tabulky planety.
- Aktivni write surface v workspace: Star Core interior entry + constitution select + policy lock (idempotency key).

## Pozorovana aktivni API surface (z FE kodu)

Auth + scope:

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /auth/me`
- `DELETE /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /galaxies` (FE bere prvni jako `defaultGalaxy`)

Workspace read:

- `GET /galaxies/{galaxy_id}/star-core/policy`
- `GET /galaxies/{galaxy_id}/star-core/physics/profile`
- `GET /galaxies/{galaxy_id}/star-core/interior`
- `GET /galaxies/{galaxy_id}/star-core/runtime`
- `GET /galaxies/{galaxy_id}/star-core/pulse`
- `GET /galaxies/{galaxy_id}/star-core/metrics/domains`
- `GET /galaxies/{galaxy_id}/star-core/physics/planets`
- `GET /universe/tables?galaxy_id=...` (fallback: `GET /galaxies/{galaxy_id}/planets`)

Workspace write:

- `POST /galaxies/{galaxy_id}/star-core/interior/entry/start` (idempotency)
- `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select` (constitution_id + idempotency)
- `POST /galaxies/{galaxy_id}/star-core/policy/lock` (idempotency + profile keys/versions)

Primarni FE reference:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/universe/UniverseWorkspace.jsx`
- `frontend/src/lib/dataverseApi.js`

## Stav vuci kanonickemu FE-BE packetu

Kanonicky packet: `/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md`

K 2026-03-16 byl packet sjednocen s realne volanymi endpointy a FE-used fields pro Star Core read model:

- endpointy `.../star-core/metrics/domains` a `.../star-core/physics/planets`
- policy: doplneno `deletion_mode`, `locked_at`
- interior: dopsana pole uvnitr `available_constitutions[]` a shape `source_truth`

## Dokumentacni dluh / rizika driftu

- `frontend/src/lib/apiV1Contract.js` a `/mnt/c/Projekty/Dataverse/scripts/release_v1_gate.sh` odkazuji na neexistujici soubor `docs/P0-core/contracts/api-v1.md`.
- Ve FE jsou stale interni nazvy `asteroids` (napr. `frontend/src/lib/snapshotNormalization.js`) a dokonce helper route `PATCH /asteroids/...`. To je v napeti s governance zakazem `asteroid*` terminologie.

## Co je “baseline task” k uzavreni mapovani

- Sjednotit packet `fe-be-active-runtime-baseline-v1CZ.md` s realne volanymi endpointy a FE-used fields (minimalne body z kapitoly Divergence).
- Rozhodnout, co je kanonicky zdroj “API v1 kontraktu” (a doplnit chybejici `docs/P0-core/contracts/*.md` nebo upravit odkazy/gate).
- Vyjasnit a zplanovat odstraneni `asteroid*` terminologie (min. v aktivni runtime + dokumentaci; idealne i v kodu).
