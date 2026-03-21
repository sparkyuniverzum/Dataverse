# Universe UI Agent Guide

Scope: `frontend/src/components/universe/`

## Mandatory Rule Load

1. Precti `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Precti `/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md`.
3. Precti `/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md`.
4. Precti tento soubor.
5. Teprve potom upravuj aktivni universe runtime soubory.

## Local Priorities

1. Aktivni FE vyvoj v tomto scope je obnoven; historicky reset uz nesmi blokovat navrat `Bloku 3`.
2. `Star Core interior` musi byt samostatna screen surface, ne overlay ani dalsi zoom uvnitr `UniverseCanvas`.
3. `Galaxy Space` a `Star Core interior` se maji chovat jako oddelene obrazovky se samostatnym ownershipem.
4. Pokud se vraci starsi inspirace, ber ji pouze z `frontend/src/_inspiration_reset_20260312/`.
5. Pred jakymkoli navratem z archivu nejdriv zapis verdict `OK / NOK / proc / co prevzit / co odstranit`.
6. `NOK` veci z archivu po schvalene davce odstraň definitivne; nenechavej je viset jako tichy backlog.
7. Nepresouvej archivovane soubory zpatky do aktivni cesty po castech bez jasneho planu.
8. Udrzuj user-visible copy cesky a strucny.
9. V tomto scope plati zavazne poradi `priprava -> navrh -> implementace`; novy UI smer se nejdriv schvaluje dokumentacne a screenshotove.
10. Pri bezne FE praci se backend kod necte pro orientaci, pokud odpoved uz obsahuje aktivni FE-BE baseline packet.

## Local Validation

1. `npm --prefix frontend run test:node -- src/components/universe/UniverseWorkspace.test.jsx`
2. `timeout 90s npm --prefix frontend run test:jsdom -- src/components/universe/UniverseWorkspace.test.jsx`
3. `npm --prefix frontend run test:node -- src/App.test.jsx src/components/app/WorkspaceShell.test.jsx`
4. `timeout 90s npm --prefix frontend run test:jsdom -- src/App.test.jsx src/components/app/WorkspaceShell.test.jsx`
5. `npm --prefix frontend run build`

## Test Runtime Note

1. V tomto workspace pod `/mnt/c` je `jsdom` cold-start velmi pomaly; neinterpretuj prvni desitky sekund jako definitivni deadlock.
2. Pro rychly collect a logic check pouzivej `test:node`.
3. Pro DOM chovani pouzivej `test:jsdom` s timeout wrapperem.
