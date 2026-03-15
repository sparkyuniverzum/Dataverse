# FE spoluprace a UX-first governance v2 (Single Source of Truth)

Stav: aktivni (jediny kanonicky zdroj pravidel FE spoluprace)
Datum: 2026-03-12
Vlastnik: uzivatel + FE agent
Rozsah: frontend, 3D vizualizace, UX architektura, FE integrace s BE

## 1. Ucel

Tento dokument je zavazna smlouva spoluprace pro FE cast projektu.

Cil:

1. mit jeden jasny zdroj pravdy pro pravidla FE spoluprace,
2. drzet UX-first kvalitu jako hard gate,
3. vyloucit nejednoznacnost mezi vice governance dokumenty.

## 2. Hierarchie pravidel

Pri konfliktu plati toto poradi:

1. projektova pravidla v `AGENTS.md` (repo + lokalni scope),
2. tento dokument,
3. aktivni FE/UX/Core kontrakty v `docs/P0-core/contracts/aktivni/*`.

Pokud je nejake pravidlo nejasne, rozhoduje tvrdsi varianta ve prospech:

1. ontologicke cistoty,
2. backend truth,
3. user-visible dopadu,
4. auditovatelnosti.

## 3. Neprekrocitelne FE principy

1. FE je stezejni produktova vrstva a musi pusobit jako `operating center`.
2. `Galaxy Space` je hlavni pracovni prostor.
3. `Star Core interior` je samostatna pracovni obrazovka, ne dalsi zoom v tomtez canvasu.
4. `civilization` je row runtime entita a `moon` je capability vrstva.
5. `asteroid*` terminologie je zakazana v runtime, UI copy i dokumentaci.
6. User-visible copy je cesky; technicke identifikatory zustavaji anglicky.
7. `work first` je povinny, `wow` je povoleny jen kdyz nepodkopava orientaci a ovladatelnost.

## 4. Pracovni smycka (povinna)

Kazdy FE/UX blok musi bez vyjimky projit poradi:

1. `priprava`,
2. `navrh`,
3. `implementace`,
4. `focused validace`,
5. `handoff`.

Implementace nesmi zacit, dokud neni v priprave explicitne napsano:

1. zavazne podminky,
2. co je mimo scope,
3. co je dukaz dokonceni,
4. co se za dokonceni nepocita.
5. pred kazdou implementacni casti agent automaticky znovu nacte tento dokument a potvrdi to ve vystupu pripravy.

## 5. Role a odpovednost

### 5.1 Agent

1. analyza kodu a dokumentace,
2. navrh a implementace bez workaround zkratek,
3. lokalni focused kontroly,
4. predani `Povel pro tebe` jen pro realne nutne prikazy,
5. ke kazdemu handoff vystupu dodat navrh `git titulek` (jedna kratka, vecna commit headline).

### 5.2 Uzivatel

1. schvaleni smeru,
2. spusteni pozadovanych testu,
3. commit a release rozhodnuti.

## 6. Red lines (zakazy)

1. zadne quick-fix workaroundy mimo canonical kontrakty,
2. zadne obchazeni OCC/idempotency/validace,
3. zadne paralelni mutation paths mimo canonical API surface,
4. zadne monolity a tiche navraceni archivnich panelu,
5. zadny claim `hotovo` bez user-visible dopadu a gate evidence.

## 7. FE architektura a data pravda

1. BE je autorita pravdy; FE nesmi simulovat finalni stav bez BE potvrzeni.
2. Kazda nova runtime FE vrstva musi mit:
   - `payload source`,
   - pouzita pole,
   - FE projekci,
   - fallback/unknown chovani,
   - guard helper.
3. `Plan preview` je povinny pred kazdou mutaci meni realitu.
4. `grid` je canonical editor pro `/civilizations*`.
5. `command bar` nesmi slibovat nic, co parser/backend realne neumi.
6. Builder je jediny system `space + command + grid` s jednou osou `preview -> commit -> convergence`.

## 8. Definition of Done (povinna 4-castna)

Dokonceni se musi reportovat rozdelene:

1. `technical completion`,
2. `user-visible completion`,
3. `documentation completion`,
4. `gate completion`.

Pokud chybi byt jedna cast, blok neni uzavren.

## 9. Dukazni standard a gate

Kazdy FE/UX blok musi dodat:

1. focused testy pro zmenenou logiku,
2. before/after screenshoty nebo rovnocenne first-view porovnani,
3. explicitni seznam viditelnych rozdilu v prvnich 30 s,
4. update aktivnich kontraktu, kterych se zmena dotyka.

Bundled smoke gate:

1. nepousti se po kazde mikro-zmene,
2. pousti se po uzavreni serie bloků nebo pred merge/release.

Hard performance/UX baseline:

1. first paint `Operation Layer` p75 <= 1.2 s, p95 <= 1.8 s,
2. time-to-first-actionable-edit p75 <= 3.0 s, p95 <= 4.5 s.

## 10. FE archiv a reuse governance

1. Archiv je technicka knihovna, ne aktivni runtime pravda.
2. Pred navratem kodu z archivu je povinny audit:
   - `OK / NOK / proc / co prevzit / co odstranit`.
3. `NOK` veci se po schvalene davce odstranuji definitivne.
4. Kazdy implementacni FE dokument musi mit sekci `Pripraveny kod z archivu`.

## 11. Jazyk zavirani bloku

Vysledny status se nesmi psat jednim vágnim slovem.
Vzdy se musi uvadet oddelene:

1. co je technicky hotove,
2. co je uzivatelsky viditelne hotove,
3. co je dokumentacne hotove,
4. co proslo gate.

## 12. Vynuceni a trust-repair

Kdyz se porusi kterykoli hard gate:

1. blok se neuzavira,
2. poruseni se explicitne zapise,
3. dalsi blok musi obsahovat trust-repair: co bylo poruseno, jak se to opravuje, jaky je dukaz.

## 13. Aktivni navazne kontrakty

Tento dokument vykonava a odkazuje na:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`,
2. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`,
3. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`,
4. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`,
5. `docs/P0-core/contracts/aktivni/ux/ux-ia-navigation-architecture-v1CZ.md`,
6. `docs/P0-core/contracts/aktivni/ux/ux-journeys-and-visual-language-v1CZ.md`,
7. `docs/P0-core/contracts/aktivni/ux/ux-fe-component-behavior-contract-v1CZ.md`,
8. `docs/P0-core/contracts/aktivni/ux/ux-operation-layer-grid-command-v1CZ.md`.

## 14. Nahrazeni starsich governance dokumentu

Timto dokumentem jsou pro aktivni rizeni spoluprace nahrazeny:

1. `docs/P0-core/governance/human-agent-alignment-protocol-v1.md`,
2. `docs/P0-core/governance/fe-ai-collaboration-contract-v1CZ.md`.

Tyto dokumenty zustavaji pouze jako archivni/kompatibilitni reference.
