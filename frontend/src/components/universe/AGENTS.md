# Universe UI Agent Guide

Scope: `frontend/src/components/universe/`

## Mandatory Rule Load

1. Precti `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Precti `/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md`.
3. Precti `/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md`.
4. Precti tento soubor.
5. Teprve potom upravuj aktivni universe runtime soubory.

## Local Priorities

1. Aktivni FE v tomto scope je po resetu minimalisticky; nepridavej zpet stare surface bez explicitniho schvaleni.
2. Zachovej cistou, citelnou zakladni workspace plochu jako novy start od nuly.
3. Pokud se vraci starsi inspirace, ber ji pouze z `frontend/src/_inspiration_reset_20260312/`.
4. Pred jakymkoli navratem z archivu nejdriv zapis verdict `OK / NOK / proc / co prevzit / co odstranit`.
5. `NOK` veci z archivu po schvalene davce odstraň definitivne; nenechavej je viset jako tichy backlog.
6. Nepresouvej archivovane soubory zpatky do aktivni cesty po castech bez jasneho planu.
7. Udrzuj user-visible copy cesky a strucny.
8. V tomto scope plati zavazne poradi `priprava -> navrh -> implementace`; novy UI smer se nejdriv schvaluje dokumentacne a screenshotove.
9. Kazdy novy FE implementacni dokument v tomto scope musi obsahovat sekci `Pripraveny kod z archivu` a vyjmenovat konkretni archived helpery/controller moduly, ktere se maji v danem bloku vratit.
10. Pri bezne FE praci se backend kod necte pro orientaci, pokud odpoved uz obsahuje aktivni FE-BE baseline packet.

## Local Validation

1. `npm --prefix frontend run test -- src/components/universe/UniverseWorkspace.test.jsx`
2. `npm --prefix frontend run test -- src/App.test.jsx src/components/app/WorkspaceShell.test.jsx`
3. `npm --prefix frontend run build`
