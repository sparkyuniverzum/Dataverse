# Průvodce Agenta pro kontraktové dokumenty

Rozsah: `docs/P0-core/contracts/`

## Povinné načtení pravidel

1. Přečti `/mnt/c/Projekty/Dataverse/AGENTS.md`.
2. Přečti tento soubor.
3. Teprve potom upravuj kontrakt/sprint/DoD dokument.
4. Dodrž root `Collaboration Contract (Mandatory)` včetně `Povel pro tebe`.

## Lokální priority

1. Každé tvrzení o stavu musí být navázané na ověřitelnou evidenci (příkaz + výsledek).
2. Otevřené položky znač `[ ]` a uzavření `[x]` + datum.
3. Drž konzistentní terminologii (`civilization` je kanonická row runtime entita, `moon` je capability/UX termín).
4. Neoznačuj uzavření bez gate evidence.
5. Aktivní kontrakty v tomto scope jsou CZ-only; paralelní aktivní EN mirror dokumenty nedrž, pokud to není explicitně schválené.
6. Technické identifikátory zůstávají anglicky (`code`, API paths, error codes, telemetry keys, DB names).
7. Historické EN mirror dokumenty patří pouze do archivní cesty `archive/en/` a nesmí být vedené jako aktivní reference.
8. Pri bezne dokumentacni praci cti defaultne jen `docs/P0-core/contracts/aktivni/`; do `docs/P0-core/contracts/splneno/` chod jen kdyz je potreba dukaz nebo historicke rozhodnuti.
9. Pokud je dokument uzavreny nebo nahrazeny, patri do vhodne podkategorie pod `docs/P0-core/contracts/splneno/`, ne mezi aktivni kontrakty.

## Vzor dokumentace

1. Co se změnilo.
2. Proč se to změnilo.
3. Evidence (příkaz + výsledek).
4. Co ještě zbývá otevřené.
