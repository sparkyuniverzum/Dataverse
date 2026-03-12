# Protokol sladění člověk-agent v1

Stav: aktivní (povinný override spolupráce pro UX-first práci)
Datum: 2026-03-11
Vlastník: uživatel + agent
Rozsah: celý repozitář, pokud je úkol rámovaný jako UX, refaktor, produktový zážitek nebo kvalita operating-center

## 1. Proč tento protokol existuje

Tento protokol vznikl, protože technické uzavření refaktoru bylo dříve zaměněno za uzavření uživatelského zážitku.

To je pro UX-first práci nepřijatelné.

Když uživatel zadá refaktor zaměřený na experience:
1. úklid architektury nestačí,
2. interní separace seamů nestačí,
3. uzavření dokumentace nestačí,
4. výsledek se musí validovat proti viditelnému dopadu na uživatele.

## 2. Nepřekročitelné interpretační pravidlo

Když repozitářové dokumenty říkají, že:
1. UX je primární kritérium,
2. slabá experience znamená selhání produktu,
3. produkt se musí cítit jako operating center,
4. hlavní pracovní zóna musí zůstat primární,
5. validace musí sledovat journey a uživatelsky viditelný dopad,

agent musí tato tvrzení brát jako tvrdé gate, ne jako kontext na pozadí.

Mají přednost před pohodlím, interní elegancí a předčasným uzavřením.

## 3. Povinný pre-implementation kontrakt

Před každým významnějším UX/refaktor blokem agent explicitně zapíše:
1. závazné podmínky převzaté z řídicích dokumentů,
2. co v aktuálním produktu tyto podmínky porušuje,
3. co se bude počítat jako přijatelný důkaz dokončení,
4. co se za dokončení počítat nebude.

Implementace nesmí začít, dokud není toto zarámování jasně a explicitně napsané.

## 4. Povinný slovník dokončení

Agent nesmí používat jedno vágní slovo jako `hotovo` nebo `done` pro smíšené stavy.

Dokončení musí být vždy rozdělené do kategorií:
1. `technical completion`
2. `user-visible completion`
3. `documentation completion`
4. `gate completion`

Pokud jedna z kategorií chybí, musí to blok explicitně říct.

## 5. UX-first akceptační pravidlo

Pro UX/product experience práci je primární standard akceptace:
1. viditelná změna ve výchozím nebo cílovém uživatelském flow,
2. lepší first impression nebo kvalita journey,
3. operating-center pocit v reálné interakci,
4. vyšší srozumitelnost hierarchie a akcí,
5. uživatelsky viditelná hodnota bez nutnosti znát interní detaily.

Následující body samy o sobě **nestačí**:
1. seam extraction,
2. token consolidation,
3. helper nebo contract creation,
4. monolith reduction,
5. drawer/mode logika, která je vidět jen v okrajových nebo skrytých stavech,
6. uzavření dokumentace,
7. passing focused unit testů bez viditelného produktového dopadu.

## 6. Pravidlo prvního dojmu

Pokud úkol míří na produktový zážitek, agent musí explicitně vyhodnotit:
1. co se změní při prvním otevření,
2. co se změní ve výchozím/idle pohledu,
3. co se změní v prvních 30 sekundách používání,
4. jestli je rozdíl viditelný bez otevírání skrytých režimů.

Pokud odpověď zní „téměř nic viditelného se nezměnilo“, blok se nesmí prezentovat jako UX úspěch.

## 7. Pravidlo opravy důvěry

Když agent neaplikuje řídicí podmínky uživatele, další blok musí:
1. explicitně zopakovat zmeškané podmínky,
2. vysvětlit, kde předchozí blok podmínky porušil,
3. nepřesouvat ověřovací práci zpět na uživatele,
4. obnovit užší a auditovatelnější pracovní kontrakt.

## 8. Pravidlo odpovědnosti za příkazy

`Povel pro tebe` je pouze pro příkazy, které uživatel skutečně potřebuje spustit.

Nesmí sloužit k tomu, aby:
1. uživatel znovu dohledával kontext, který má shrnout agent,
2. uživatel četl dokumenty, které měl interpretovat agent,
3. nahrazoval chybějící analýzu,
4. přenášel práci uvažování z agenta na uživatele.

## 9. Požadovaný důkaz pro budoucí UX bloky

Pro jakýkoli další UX-first blok má přijatelný důkaz obsahovat kombinaci:
1. before/after screenshotů nebo explicitního first-view porovnání,
2. konkrétního seznamu okamžitě viditelných rozdílů,
3. cílené validace uživatelského flow,
4. úzkých testů pro dotčenou logiku,
5. bundled gate až po uzavření série UX bloků.

## 10. Souhrn vynucení

Pro UX/refaktor/product-experience úkoly:
1. nejdřív zapiš podmínky,
2. posuzuj viditelný dopad před interní čistotou,
3. nikdy neoznač architektura-only progres za UX úspěch,
4. nikdy neslučuj completion stavy do jednoho vágního tvrzení,
5. nikdy neposílej uživatele zpátky do materiálů, které má interpretovat agent.
