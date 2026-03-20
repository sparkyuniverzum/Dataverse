# FE Baseline Status (Frontend)

Datum: 2026-03-21
Repo: `/mnt/c/Projekty/Dataverse` (branch `staging`, HEAD `db5e437`)

## Gate stav (lokalne, focused repair)

- `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/components/app/WorkspaceShell.test.jsx src/components/universe/UniverseWorkspace.test.jsx`: PASS (11/11)
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

K 2026-03-21 je packet srovnan s realne aktivnim FE runtime:

- auth/bootstrap cast uz netvrdi neaktivni `POST /auth/token`
- branch scope je zapsan jako support surface, ne jako bezna aktivni UI cesta
- parser write pipeline odpovida realnemu flow `plan -> execute-batch`

## Dokumentacni dluh / rizika driftu

- `scripts/release_v1_gate.sh` stale odkazuje na starsi `docs/P0-core/contracts/api-v1.md`; frontend helper registry uz byla srovnana na aktualni FE baseline.
- Build stale hlasi velky bundle (`dist/assets/index-*.js` > 500 kB); neni to baseline drift, ale zustava to performance dluh.

## Co je “baseline task” k uzavreni mapovani

- Opravit zbyvajici repo-level gate skripty, ktere stale miri na archivni kontraktove cesty mimo aktivni FE baseline packet.
- Rozhodnout, jestli se ma helper registry dale drzet jako aktivni surface index, nebo uplne nahradit jednim canonical packetem.
