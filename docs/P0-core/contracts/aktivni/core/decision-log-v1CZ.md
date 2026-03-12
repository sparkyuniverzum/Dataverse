# Decision log v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: Produkt + FE + BE

## 1. Ucel

Tento dokument drzi kratkou aktivni pamet projektu.

Smysl:

1. nevracet uzavrena rozhodnuti znovu do diskuse bez duvodu,
2. zmensit tlak na kontextove okno,
3. udrzet jasnou aktivni pravdu pro dalsi bloky.

## 2. Aktivni rozhodnuti

### D-001 Hlavni pracovni prostor neni selector galaxii

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. `Nexus / Galaxy Selector` je vstupni brana.
2. Hlavni pracovni prostor je `Galaxy Space Workspace`.
3. Hvezda je centralni governance anchor uvnitr prostoru, ne cely workspace.

Vyrazeno:

1. `star-first locked camera` jako definice celeho workspace.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

### D-002 Onboarding a workspace jsou oddelene vrstvy

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. prvnich 30 sekund se neresi uvnitr hlavniho workspace,
2. onboarding/cinematic vrstva je samostatny blok,
3. hlavni workspace se navrhuje samostatne a kompletne.

Vyrazeno:

1. tlacit workspace k onboarding roli jen kvuli prvnimu dojmu.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

### D-003 Work first, wow hlavne vizualem

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. priorita je pracovni citelnost,
2. `wow` se ma koncentrovat do prostoru, svetla, objektu a prechodu stavu,
3. `wow` nesmi vznikat vrsenim panelu a copy.

Vyrazeno:

1. druhotne karty a duplicitni povrchove explanatory panely.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/fe/fe-vision-v2-spatial-galaxy-entry-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`

### D-004 Builder system je trojvrstva

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. builder se sklada z `space navigation -> command bar -> grid`,
2. builder neni stary `stage-zero` panelovy shell,
3. archived kod se smi vracet jen jako logika a kontrakty, ne jako stare UI.

Vyrazeno:

1. `StageZeroSetupPanel` jako aktivni FE smer.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/fe/fe-builder-system-galaxy-space-workspace-v1CZ.md`

### D-005 Blok 3 potrebuje canonical BE orchestration

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. `Blok 3` neni jen FE spatial vrstva,
2. `Constitution Select -> Policy Lock -> first_orbit_ready` musi mit canonical backend pravdu,
3. FE se k `Bloku 3` vraci az nad novym `interior` contractem.

Vyrazeno:

1. FE jako jediny nositel workflow truth pro interier hvezdy.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-endpoint-contract-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/be/be-star-core-interior-implementacni-dokument-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`

### D-006 Interiery nejsou dalsi zoom ve stejnem prostoru

Datum: 2026-03-12
Stav: aktivni

Rozhodnuti:

1. `Star Core interior` je samostatna pracovni obrazovka, ne dalsi hloubeji zanořena vrstva uvnitr `Galaxy Space`.
2. Stejny princip ma pozdeji platit i pro interier planety a dalsi hlubsi operacni vrstvy.
3. Spatial transition muze byt plynuly a diegeticky, ale cil uz neni "zustat ve stejnem canvasu".

Vyrazeno:

1. predstava, ze interier hvezdy bude jen dalsi kamera / zoom uvnitr stejne vesmirne sceny.

Zdroj pravdy:

1. `docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

## 3. Pravidlo pouziti

1. Pri beznem navrhu a implementaci se tento log cte pred navratem ke starsim diskusim.
2. Pokud ma byt nektere rozhodnuti zmeneno, musi vzniknout novy zaznam a stary musi byt explicitne oznacen jako nahrazeny.
