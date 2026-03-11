# Kanonická UX ontologie v1 (Canonical UX Ontology v1)

Tady je kompletní a přesný překlad celého dokumentu do češtiny:

Status: aktivní (kanonický základ plánování / canonical planning baseline)
Datum: 2026-03-10
Vlastník: Produktové UX + Core FE/BE architektura

## 1. Co se změnilo

Tento dokument definuje kanonický základ UX ontologie pro kompletní přepracování produktu:

1. jednotný jazyk pro produktový design,
2. jednotné mapování mezi doménou a runtimem,
3. jednotný model chování pro hlavní entity,
4. jednotný interakční model pro to, jak na sebe mohou navzájem reagovat entity, parser, runtime a plochy uživatelského rozhraní (UI surfaces).

Toto je povinný základ pro budoucí návrh end-to-end workflow.

## 2. Proč se to změnilo

Současný projekt je sémanticky správný, ale provozně nejednoznačný:

1. Kontrakt Měsíce (Moon) definuje `Moon` jako schopnost (capability).
2. Kontrakt Civilizace definuje `Civilization` jako instanci řádku (row instance).
3. Dokumenty k dodávce planet/civilizací používají `civilization` jako kanonický runtime jazyk.

Bez jediné oficiální UX ontologie by návrh workflow neustále míchal:

* sémantiku schopností (capabilities),
* sémantiku řádků,
* sémantiku aliasů,
* pozůstatky implementace.

## 3. Rozsah tohoto dokumentu

Tato verze pokrývá pouze:

1. `A` ontologii entit,
2. `B` ontologii interakcí.

Tato verze zatím nedefinuje:

1. kompletní architekturu obrazovek,
2. navigační mapu,
3. kompletní end-to-end uživatelské cesty (user journeys),
4. vizuální systém.

## 4. Kanonické pořadí rozhodování

Při konfliktu v terminologii použijte toto pořadí priorit:

1. `doménová pravda (domain truth)`
2. `pravda v runtime (runtime truth)`
3. `jazyk UX (UX language)`
4. terminologie kompatibilitních aliasů

Názvosloví pro zpětnou kompatibilitu může existovat, ale nikdy nesmí redefinovat význam domény.

## 5. Doménová pravda

### 5.1 Galaxie (Galaxy)

Galaxie je hranicí pracovního prostoru (workspace) a rozsahem tenanta.
Galaxie vlastní:

* rozsah životního cyklu planet,
* rozsah civilizací,
* časové osy větví (branch timelines),
* stav onboardingu,
* kontext správy hvězdy (star governance context).

Galaxie není:

* vizuální záložka (tab),
* branch (větev),
* výběr platný pouze pro danou relaci (session).

### 5.2 Hvězda (Star)

Hvězda je vrstva zákonů a správy (governance) pro jednu galaxii.
Hvězda vlastní:

* ústavu,
* stav uzamčení politik (policy lock),
* fyzikální profil,
* kontext řízení běhu (runtime control context).

Hvězda není:

* planeta,
* karta na dashboardu,
* objekt na úrovni řádku.

### 5.3 Planeta (Planet)

Planeta je agregát tabulky a nosič strukturálních dat.
Planeta vlastní:

* hranici tabulkového kontraktu,
* kontejner populace civilizací,
* hranici pro připojení schopností (capability attachment),
* vizuální umístění v pracovním prostoru.

Planeta není:

* schopnost (capability),
* jeden řádek,
* dočasný koncept (draft).

### 5.4 Měsíc (Moon)

Měsíc je modul schopnosti (capability module) připojený ke kontraktu planety.
Měsíc není instance řádku.

Třídy schopností Měsíce zahrnují:

* Dictionary Moon (Slovníkový měsíc),
* Validation Moon (Validační měsíc),
* Formula Moon (Vzorcový měsíc),
* Bridge Moon (Přemosťovací měsíc).

Měsíc vlastní:

* chování schopnosti (capability behavior),
* sémantiku validací,
* sémantiku vzorců,
* sémantiku přemostění/vazeb (bridge/link),
* efekty řízené kontraktem dopadající na zápisy a projekce civilizací.

Měsíc není:

* živá populace řádků,
* alias civilizace v doménové pravdě,
* prvotřídní CRUD entita na úrovni řádku.

### 5.5 Civilizace (Civilization)

Civilizace je instance řádku na planetě.
Je to entita živé populace, která může být:

* vytvořena,
* mutována (upravena),
* validována,
* propojena (linked),
* vyhašena (extinguished).

Civilizace vlastní:

* data řádku,
* stav životního cyklu,
* typované hodnoty minerálů,
* způsobilost k relacím,
* viditelnost v projekci.

Civilizace není:

* modul schopnosti (capability module),
* tabulkový kontrakt,
* planeta.

### 5.6 Minerál (Mineral)

Minerál je typovaná hodnota pole uvnitř dat civilizace.
Minerál je vrstva faktů/hodnot, nikoliv samostatná populační entita.

Minerál vlastní:

* typovanou hodnotu,
* typ zdroje,
* výsledek validace,
* stav odvozený ze vzorce (je-li to aplikovatelné).

### 5.7 Vazba (Bond)

Vazba je relace mezi civilizacemi.
Vazba vlastní:

* relaci zdroj-cíl (source-target),
* sémantiku vazby,
* stav životního cyklu,
* runtime důsledky řízené vazbou (link-driven).

Vazba není:

* blok schopnosti (capability block),
* planeta,
* hrana větve ve smyslu správy verzí (version control).

### 5.8 Větev (Branch)

Branch je izolovaná experimentální časová osa v rámci jedné galaxie.
Branch vlastní:

* izolovanou historii událostí,
* životní cyklus promote/review,
* dočasnou divergenci od hlavní časové osy.

Branch není:

* vizuální složka,
* uložený filtr,
* dočasný koncept (draft objekt).

### 5.9 Srdce hvězdy (Star Core)

Srdce hvězdy je řídicí rovina (control plane) pro správu a runtime.
Vlastní:

* politiky (policy),
* fyzikální profil,
* zdraví runtime,
* metriky,
* puls,
* outbox operace.

Srdce hvězdy není:

* primární editační plocha pro planety/civilizace,
* onboardingový shell,
* náhrada za časovou osu nebo workflow log.

## 6. Pravda v runtime (Runtime truth)

Současná implementace nese ontologii prostřednictvím těchto pravidel:

1. `civilization` je kanonický runtime termín pro řádek.
2. `/civilizations*` je kanonický jmenný prostor pro CRUD operace s řádky.
3. `/moons*` není kanonický runtime CRUD namespace a nesmí se používat jako jmenný prostor řádků.
4. Stav schopností Měsíce (Moon capability state) je řízen kontraktem na vrstvě planety/tabulky.
5. Kontrakt planety a životní cyklus řádku civilizace jsou oddělené domény zápisu.
6. Rozsah běhu (Runtime scope) je vždy `user_id + galaxy_id (+ volitelně branch_id)`.

Důsledek pro runtime:
`Schopnost Měsíce != Řádek civilizace`, a to i v případě, že kompatibilitní endpointy stále vystavují `/moons*`.

## 7. Jazyk UX

### 7.1 Primární jazyk pro novou práci na UX

Výchozí UX slovník pro novou práci na produktu musí být:

* Galaxie (Galaxy)
* Hvězda (Star)
* Planeta (Planet)
* Civilizace (Civilization)
* Minerál (Mineral)
* Vazba (Bond)
* Branch (Větev)
* Srdce hvězdy (Star Core)

### 7.2 Kontrolované použití slova `moon`

`Moon` se může v UX objevit pouze pro význam schopnosti na plochách kontraktu planety.
`Moon` musí být vždy kvalifikováno jako schopnost (například: "Moon capability").

### 7.3 Zakázaná nejednoznačnost

UX nikdy nesmí používat `moon` jako synonymum pro instanci řádku.
Instance řádku musí být vždy označena jako `civilization`.

## 8. Mapovací tabulka

| Vrstva | Kanonický význam | Povolený štítek (Label) | Zakázaná zkratka |
| --- | --- | --- | --- |
| Doména | Moon = schopnost | `Moon` na plochách schopností | `Moon = řádek` |
| Doména | Civilization = řádek | `Civilization` | `Civilization = schopnost` |
| Runtime | `/civilizations*` = CRUD řádků | `Civilization` | zacházení s `/moons*` jako s kanonickým termínem |
| Runtime | `/moons*` | Nepovoleno jako jmenný prostor pro CRUD řádků | zavádění endpointů životního cyklu řádku na `/moons*` |
| UX | rozšíření kontraktu planety | `Moon capability` | pouhé `Moon`, když by si to uživatel mohl vyložit jako řádek |
| UX | životní cyklus řádku | `Civilization` | `Moon` bez kvalifikace |

## 9. Ontologie entit

Každá níže uvedená entita je definována tím:

1. co to je,
2. proč to existuje,
3. co to vlastní,
4. na co to může reagovat,
5. co to může ovlivnit,
6. jaké stavy může odhalovat,
7. co s tím může uživatel dělat,
8. co o tom nesmí UI naznačovat.

### 9.1 Kontrakt entity Galaxie (Galaxy)

Co to je:
Galaxie je nejvyšší hranicí pracovního prostoru.

Proč to existuje:
Zabraňuje nejednoznačnosti mezi tenanty a různými pracovními prostory.

Co vlastní:

* rozsah pracovního prostoru,
* záznam o onboardingu,
* univerzum aktivních větví (branches),
* kontext správy hvězdy.

Na co může reagovat:

* vytvoření (create),
* výběr (select),
* vyhašení (extinguish),
* aktualizace onboardingu,
* vytvoření větve,
* povýšení (promote) větve.

Co může ovlivnit:

* překlad rozsahu každého čtení/zápisu,
* viditelnou identitu pracovního prostoru,
* dostupné větve,
* dostupný kontext správy (governance).

Stavy:

* dostupná (available),
* vybraná (selected),
* nedokončený onboarding (onboarding_incomplete),
* onboarding připraven (onboarding_ready),
* archivována.

Akce uživatele:

* vypsat,
* vytvořit,
* vstoupit,
* zkontrolovat onboarding,
* přepnout kontext větve,
* vyhasit.

UI nesmí naznačovat:

* že galaxie je jen nedávno otevřený soubor,
* že přepnutí galaxie je neškodné, pokud existuje aktivní stav konceptu (draft).

### 9.2 Kontrakt entity Hvězda (Star)

Co to je:
Hvězda je vrstva zákonů a správy (governance) pro jednu galaxii.

Proč to existuje:
Hlídá a vysvětluje pravidla vyššího řádu před toky, které mění strukturu v builderu/runtime.

Co vlastní:

* uzamčení politik (policy lock),
* fyzikální profil,
* pravidla správy,
* stav řídicí roviny (control-plane).

Na co může reagovat:

* uzamčení (lock),
* uplatnění profilu,
* migrace profilu,
* požadavek na metriky,
* dotaz na runtime.

Co může ovlivnit:

* propustnosti pro vytváření planet (gates),
* interpretaci v runtime,
* plochy pro správu (governance surfaces),
* vysvětlující texty v omezených tocích.

Stavy:

* odemčena (unlocked),
* uzamčena (locked),
* politika připravena (policy_ready),
* fyzika připravena (physics_ready),
* varování správy (governance_warning).

Akce uživatele:

* prozkoumat (inspect),
* uzamknout,
* uplatnit politiku/profil,
* migrovat profil,
* prozkoumat runtime.

UI nesmí naznačovat:

* že hvězda je volitelná, jakmile jsou aktivní governance propustnosti,
* že jde pouze o dekorativní metaforu.

### 9.3 Kontrakt entity Planeta (Planet)

Co to je:
Planeta je nosič strukturálních dat a agregát tabulky.

Proč to existuje:
Poskytuje datům civilizací a jejich schopnostem jeden deterministický kontejner.

Co vlastní:

* identitu tabulky,
* hranici kontraktu,
* hranici připojení schopností (capability),
* kontejner populace,
* vizuální umístění.

Na co může reagovat:

* umístění (placement),
* přejmenování/reklasifikaci,
* aktualizaci kontraktu,
* nasazení výchozích řádků (seed rows),
* obnovení vizualizace.

Co může ovlivnit:

* dostupné schéma civilizace,
* dostupné chování schopností (capability behavior),
* agregáty na dashboardu,
* rozložení (layout) a navigaci.

Stavy:

* chybí (absent),
* umístěna (placed),
* prázdná (empty),
* nakonfigurována (configured),
* nasazena data (seeded),
* aktivní (active),
* archivována (archived).

Akce uživatele:

* vytvořit/umístit,
* prozkoumat,
* nakonfigurovat,
* seedovat data,
* navigovat do,
* zkontrolovat dopad,
* archivovat.

UI nesmí naznačovat:

* že planeta a blok schématu jsou ten samý objekt,
* že vytvoření planety automaticky znamená použitelnou populaci.

### 9.4 Kontrakt entity Měsíc (Moon)

Co to je:
Měsíc je modul schopnosti připojený ke kontraktu planety.

Proč to existuje:
Vysvětluje a strukturuje na planetární vrstvě to chování, které se netýká přímo řádků.

Co vlastní:

* identitu schopnosti,
* chování validací/typování,
* chování vzorců,
* chování přemostění (bridge),
* efekty na úrovni kontraktu.

Na co může reagovat:

* skládání schopností (assembly),
* commit kontraktu,
* náhled schopností (preview),
* nahrazení/verzování kontraktu.

Co může ovlivnit:

* validaci civilizace,
* povolené hodnoty minerálů,
* projekce vzorců,
* sémantiku vazeb a pravidla přemostění.

Stavy:

* nedostupný (unavailable),
* volitelný (selectable),
* sestavený (assembled),
* v náhledu (previewed),
* commitnutý (committed),
* nahrazený (superseded).

Akce uživatele:

* prozkoumat význam schopnosti,
* přidat/odebrat bloky schopností v builderu,
* zobrazit náhled dopadů schopnosti,
* commitnout změny schopností.

UI nesmí naznačovat:

* že uživatel upravuje data řádku,
* že bloky schopností jsou civilizace,
* že úprava schopností je CRUD řádků.

### 9.5 Kontrakt entity Civilizace (Civilization)

Co to je:
Civilizace je instance živého řádku na planetě.

Proč to existuje:
Je to primární mutovatelná populační entita pro každodenní práci operátora.

Co vlastní:

* identitu řádku,
* data řádku,
* aktuální stav životního cyklu,
* hodnoty minerálů,
* výsledky validací,
* způsobilost k vazbám.

Na co může reagovat:

* vytvoření,
* ingestování,
* mutaci,
* aktualizaci minerálu,
* vytvoření/zrušení vazby (link/unlink),
* vyhašení (extinguish),
* přehrání projekce (projection replay).

Co může ovlivnit:

* počty řádků na planetě,
* souhrny na dashboardu,
* vizuální stav runtime,
* log workflow,
* validační a opravné toky.

Stavy:

* chybí (absent),
* koncept (draft),
* v náhledu (previewed),
* aktivní (active),
* neplatná (invalid),
* zablokovaná (blocked),
* propojená (linked),
* vyhašená (extinguished),
* historická.

Akce uživatele:

* vytvořit,
* prozkoumat,
* upravit,
* obohatit minerály,
* propojit vazby,
* vyhasit,
* obnovit ze zablokovaného zápisu.

UI nesmí naznačovat:

* že civilizace je schopnost,
* že smazání civilizace je "hard delete" (fyzické smazání),
* že samotný výběr znamená potvrzený režim úprav (committed edit mode).

### 9.6 Kontrakt entity Minerál (Mineral)

Co to je:
Minerál je typovaný fakt/hodnota uvnitř dat civilizace.

Proč to existuje:
Dává stavu civilizace smysluplný, typovaný a vysvětlitelný obsah.

Co vlastní:

* klíč (key),
* typovanou hodnotu,
* typ zdroje,
* stav validace,
* status odvozený ze vzorce nebo výpočtu (tam, kde je to relevantní).

Na co může reagovat:

* přímou úpravu,
* intent z parseru,
* přepočet vzorce,
* výsledek validátoru,
* pravidlo strážce/blokování (guardian/blocking rule).

Co může ovlivnit:

* platnost řádku,
* vypočítané výstupy,
* varování v náhledu,
* navazující (downstream) governance pravidla nebo pravidla přemostění.

Stavy:

* prázdný (empty),
* naplněný (populated),
* neplatný (invalid),
* vypočítaný (calculated),
* zablokovaný (blocked),
* zastaralý (stale),
* archivovaný spolu s řádkem.

Akce uživatele:

* upravit,
* prozkoumat zdroj,
* opravit neplatnou hodnotu,
* trasovat původ vzorce/výpočtu.

UI nesmí naznačovat:

* že minerál je nezávislý řádkový objekt,
* že vypočítaná hodnota je přímo upravitelná, když tomu tak není.

### 9.7 Kontrakt entity Vazba (Bond)

Co to je:
Vazba je relace mezi civilizacemi.

Proč to existuje:
Vyjadřuje relaci, tok (flow) nebo sémantiku strážce (guardian) mezi řádkovými entitami.

Co vlastní:

* identitu zdroje/cíle,
* typ vazby,
* životní cyklus relace,
* důsledky napříč planetami.

Na co může reagovat:

* náhled (preview),
* vytvoření,
* změnu typu (retype),
* vyhašení,
* blokující pravidla,
* neshodu rozsahů (scope mismatch).

Co může ovlivnit:

* topologii grafu,
* výsledky schopností přemostění (bridge),
* vysvětlitelnost a tipy k opravám (repair hints),
* dashboard a stav v runtime.

Stavy:

* chybí (absent),
* koncept (draft),
* v náhledu (previewed),
* aktivní (active),
* zablokovaná (blocked),
* vyhašená (extinguished),
* historická.

Akce uživatele:

* prozkoumat,
* vytvořit,
* zobrazit náhled,
* vyřešit nejednoznačnost,
* vyhasit.

UI nesmí naznačovat:

* že každá protažená čára (line) je vždy platná k potvrzení (commit),
* že zablokovaná relace se prostě tiše neprovede (silent no-op).

### 9.8 Kontrakt entity Branch (Větev)

Co to je:
Branch je izolovaná časová osa událostí v jedné galaxii.

Proč to existuje:
Umožňuje bezpečné experimentování před povýšením (promote) do hlavní (main) větve.

Co vlastní:

* identitu větve,
* název větve,
* časovou osu větve,
* stav povýšení (promote state).

Na co může reagovat:

* vytvoření,
* výběr,
* zápisy do časové osy,
* povýšení,
* uzavření (closure).

Co může ovlivnit:

* rozsah čtení (read scope),
* rozsah zápisu (write scope),
* srovnání v náhledu (preview comparison),
* toky pro kontrolu (review) a slučování (merge).

Stavy:

* chybí (absent),
* aktivní (active),
* vybraná (selected),
* odchýlená (diverged),
* připravená k povýšení (promotable),
* povýšená (promoted),
* uzavřená (closed).

Akce uživatele:

* vytvořit,
* vstoupit,
* porovnat,
* zkontrolovat (review),
* povýšit (promote).

UI nesmí naznačovat:

* že branch je pouze vizuální filtr,
* že hlavní a branch časové osy jsou volně zaměnitelné.

### 9.9 Kontrakt entity Srdce hvězdy (Star Core)

Co to je:
Srdce hvězdy je řídicí rovina (control plane) pro governance a runtime.

Proč to existuje:
Centralizuje politiky, zdraví runtime, metriky a ovládací prvky na úrovni operátora.

Co vlastní:

* stav politik,
* stav runtime,
* data pulsu,
* metriky domén,
* stav outboxu.

Na co může reagovat:

* uzamčení politiky,
* migraci profilu,
* jednorázové spuštění outboxu,
* dotaz na stav,
* požadavek na metriky.

Co může ovlivnit:

* důvěru operátora,
* kontrolu správy (governance review),
* nápravná opatření (remediation actions),
* připravenost k rozhodnutím o vydání/povýšení (release/promote).

Stavy:

* nominální (nominal),
* varování (warning),
* degradovaný (degraded),
* uzamčený (locked),
* vyžaduje se akce (action_required).

Akce uživatele:

* prozkoumat,
* spustit operátorskou akci,
* zkontrolovat metriky,
* potvrdit stav politik/governance.

UI nesmí naznačovat:

* že akce ve star-core jsou součástí každodenního toku úprav řádků,
* že operace řídicí roviny jsou snadno vratné jako lokální koncepty (drafts).

## 10. Ontologie interakcí

Tato část definuje, jak na sebe mohou reagovat hlavní entity a systémy.
Pokud interakce není definována zde nebo ve specifičtějším kontraktu, UX s ní musí zacházet jako s nepodporovanou.

### 10.1 Interakce Galaxie

Galaxie může reagovat s:

* Hvězdou
* Planetou
* Větví (Branch)
* Onboardingem
* Srdcem hvězdy

Galaxie nesmí přímo reagovat s:

* Minerálem jako nezávislým rozsahem nejvyšší úrovně
* Vazbou jako relací napříč různými galaxiemi

Pravidlo chování:
Každý smysluplný tok uživatele začíná v rámci jednoho přeloženého (resolved) rozsahu galaxie.

### 10.2 Interakce Hvězdy

Hvězda může reagovat s:

* Galaxií
* Propustností (gate) pro vytvoření planety
* Srdcem hvězdy

Hvězda nesmí přímo reagovat s:

* úpravou jednotlivého minerálu jako primárním UX objektem

Pravidlo chování:
Hvězda přímo ovlivňuje správu (governance) a připravenost, nikoliv samotnou mechaniku úpravy řádků.

### 10.3 Interakce Planety

Planeta může reagovat s:

* Schopností Měsíce (Moon capability)
* Civilizací
* Souhrny vazeb
* Čtením s rozsahem větve (Branch-scoped reads)
* vizuálním umístěním/runtime projekcí

Planeta nesmí reagovat tak, jako by byla:

* editorem řádků
* sama o sobě schopností (capability)

Pravidlo chování:
Planeta je kontejnerem a povrchem kontraktu pro práci s civilizacemi.

### 10.4 Interakce Měsíce

Měsíc může reagovat s:

* Kontraktem planety
* Skládáním schopností v builderu
* Validační cestou civilizace
* Efekty vzorců a přemostění (bridge)

Měsíc nesmí reagovat tak, jako by byl:

* přímým CRUD řádku
* vybraným členem populace

Pravidlo chování:
Měsíc mění chování řádků nepřímo prostřednictvím sémantiky kontraktů/schopností.

### 10.5 Interakce Civilizace

Civilizace může reagovat s:

* Planetou
* Minerálem
* Vazbou
* Časovou osou větve
* Intenty parseru
* výběrem v mřížce/plátně/inspektoru

Civilizace nesmí reagovat tak, jako by byla:

* balíčkem schopností (capability pack)
* globální entitou mimo rozsah planety

Pravidlo chování:
Civilizace je primární jednotkou pro úpravu dat a vysvětlování v operativním UX.

### 10.6 Interakce Minerálu

Minerál může reagovat s:

* Civilizací
* validátory
* vzorci
* intenty parseru
* tipy k opravám (repair hints)

Minerál nesmí reagovat tak, jako by byl:

* volně plovoucí entitou bez kontextu civilizace

Pravidlo chování:
Úpravy minerálů musí zůstat vysvětlitelné a typované.

### 10.7 Interakce Vazby

Vazba může reagovat s:

* Civilizací vůči Civilizaci
* Důsledky přemostění (bridge implications) na úrovni planety
* náhledem (preview) v parseru
* tipy k opravám z důvodu blokování nebo nejednoznačnosti

Vazba nesmí reagovat tak, jako by byla:

* volnou dekorativní čárou bez sémantických důsledků

Pravidlo chování:
Každá operace s vazbou musí odhalit její platnost, rozsah a dopad.

### 10.8 Interakce Větve (Branch)

Větev může reagovat s:

* Galaxií
* Čtením a zápisy do Planety/Civilizace/Vazeb
* toky pro porovnání/kontrolu (review)/povýšení (promote)

Větev nesmí reagovat tak, jako by byla:

* náhradou za lištu pro koncepty (draft rail)
* lokálním krokem zpět (undo stack) přímo v UI

Pravidlo chování:
Větev znamená izolaci časové osy, nikoliv lokální stav na úrovni widgetu.

### 10.9 Interakce Srdce hvězdy (Star Core)

Srdce hvězdy může reagovat s:

* Hvězdou
* Galaxií
* zdravím v runtime
* metrikami
* outbox operacemi

Srdce hvězdy nesmí reagovat tak, jako by bylo:

* běžnou cestou pro vytváření nebo úpravu civilizací

Pravidlo chování:
Srdce hvězdy slouží jako řídicí rovina pro governance a podporu, nikoliv jako primární autorská plocha.

### 10.10 Interakce Parseru

Parser může reagovat s:

* Intenty planet
* Intenty civilizací
* Intenty minerálů
* Intenty vazeb
* Rozsahem s ohledem na větve (Branch-aware scope)
* vysvětlitelností a řešením nejednoznačností

Parser nesmí reagovat jako:

* skrytý sidecar pouze pro experty,
* černá skříňka pro mutace, kterou nelze zkontrolovat.

Pravidlo chování:
Parser je prvotřídní intentový stroj, jehož výstup se musí vždy vyhodnotit jako:

1. pochopený záměr (intent),
2. vyžaduje se vyjasnění,
3. zablokováno pravidlem.

### 10.11 Interakce ploch uživatelského rozhraní (UI surfaces)

Hlavní plochy UI mohou reagovat s těmito třídami entit:

* Brána Galaxie (Galaxy Gate) <-> Galaxie, onboarding, nedávný kontext
* Shell pracovního prostoru (Workspace shell) <-> Galaxie, Branch, stav runtime
* Hlavní plocha (Main surface) <-> Planeta, Civilizace, Vazba
* Inspektor/Draft lišta <-> vybraná entita nebo aktuální draft
* Časová osa/log (Timeline/log) <-> commity, varování, události v runtime, tipy k opravám
* Plocha pro správu (Governance surface) <-> Hvězda, Srdce hvězdy, review Větve

Pravidlo chování:
Žádná UI plocha si nesmí vymýšlet svou vlastní ontologii. Všechny štítky a stavy se musí mapovat zpět na sekce 5 až 10.

### 10.12 Interakce runtime a chyb

Runtime může reagovat s UX prostřednictvím:

* výsledků náhledu (preview results),
* chyb validací,
* OCC konfliktů,
* dat pro vysvětlitelnost (explainability payloads),
* stavu offline/konektivity,
* varování o neshodě v konvergenci nebo projekci.

Pravidlo chování:
Chyby musí být vždy namapovány na:

1. co selhalo,
2. proč to selhalo,
3. co zůstalo nezměněno,
4. co může uživatel udělat dál.

## 11. Oficiální mantinely pro další fáze návrhu

1. Návrh end-to-end workflow musí vycházet z této ontologie.
2. Architektura obrazovek nesmí redefinovat význam entit.
3. Parser, formuláře, plátno (canvas), mřížka (grid) a logy se musí mapovat na stejný model entit.
4. Úpravy schopností (capabilities) a životní cyklus řádku musí v nových tocích (flows) zůstat oddělené.
5. Kompatibilitní aliasy mohou být vysvětleny, ale nikdy se s nimi nesmí zacházet jako s kanonickým názvoslovím UX.
