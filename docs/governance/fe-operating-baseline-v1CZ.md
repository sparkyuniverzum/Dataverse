# FE Operating Baseline v1

Stav: aktivni
Datum: 2026-03-16
Vlastnik: uzivatel + FE agent
Rozsah: kazdodenni FE prace, FE handoff, FE prace nad BE kontrakty bez nutnosti znovu cist backend

## 1. Ucel

Tento dokument zmrazuje aktualni provozni baseline a rika, jak se ma vest dalsi FE prace.

Cil:

1. zastavit dalsi improvizovane vize behem implementace,
2. oddelit strategii od bezne FE exekuce,
3. zavest predvidatelny system `FE task -> packet -> implementace -> update packetu`.

## 2. Aktualni baseline produktu

1. `Galaxy Space` je hlavni pracovni prostor.
2. `Star Core` je centralni governance anchor uvnitr workspace.
3. `Star Core interior` je samostatna pracovni obrazovka nad canonical backend truth.
4. Backend je autorita workflow pravdy.
5. FE je povoleno menit jen:
   - prezentaci,
   - adaptery,
   - guardy,
   - focused UX tok,
   - dokumentacni packet truth.

## 3. Co se ma zastavit

V implementacnich vlaknech se nema znovu otevirat:

1. nova produktova vize bez explicitniho pozadavku uzivatele,
2. alternativni FE workflow pravda mimo BE kontrakty,
3. spekulativni navrhy "co vsechno by system mohl byt",
4. backend spelunking jen proto, aby se agent zorientoval.

## 4. Aktivni dalsi smer vyvoje

Do dalsi zmeny je spravny smer tento:

1. FE se opira o aktualni aktivni runtime baseline,
2. BE truth pro FE se drzi v jednom packetu,
3. pri bezne FE praci se backend necte, pokud packet staci,
4. pri kontraktove zmene se nejdriv opravi packet a teprve pak se siri implementace.

To je aktualni provozni vize.
Neni to produktovy brainstorming dokument.

## 5. Povinny pracovni cyklus pro FE

Kazdy FE blok ma jit v tomto poradi:

1. precist root [AGENTS.md](/mnt/c/Projekty/Dataverse/AGENTS.md),
2. precist tento dokument,
3. precist [docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md),
4. precist lokalni `AGENTS.md`,
5. implementovat jen v rozsahu, ktery packet pokryva,
6. pokud packet nestaci, nejdriv doplnit packet,
7. teprve potom pokracovat v sirokem FE zasahu.

## 6. Kdy je dovoleno jit do BE kodu

Backend kod se ma cist jen kdyz:

1. meni se backend,
2. FE packet neobsahuje odpoved,
3. packet je zjevne v rozporu s kodem nebo testy,
4. uzivatel explicitne chce BE analyzu.

Pokud zadny z techto bodu neplati, FE agent nema pro orientaci lezt do BE.

## 7. Kdy se blok musi zastavit

Blok se musi zastavit a prepnout do dokumentacni opravy, pokud:

1. FE potrebuje pole nebo endpoint, ktery packet nepopisuje,
2. FE narazi na nejasnou semantiku payloadu,
3. FE kod obsahuje fallback, ktery uz neni podlozen kontraktem,
4. existuji dve ruzne pravdy v dokumentaci a neni jasne, ktera je aktivni.

## 8. Definition of Done pro FE baseline bloky

Blok je zavren jen kdyz je zvlast uvedeno:

1. co je technicky hotove,
2. co je user-visible hotove,
3. co bylo dopsano do packetu/dokumentace,
4. jake focused gate probehly.

## 9. Kanonicke dokumenty pro FE exekuci

Cti jako aktivni minimum:

1. [AGENTS.md](/mnt/c/Projekty/Dataverse/AGENTS.md)
2. [docs/governance/fe-collaboration-single-source-of-truth-v2CZ.md](/mnt/c/Projekty/Dataverse/docs/governance/fe-collaboration-single-source-of-truth-v2CZ.md)
3. [docs/governance/fe-operating-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/governance/fe-operating-baseline-v1CZ.md)
4. [docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/contracts/fe/fe-be-active-runtime-baseline-v1CZ.md)

## 10. Ocekavany efekt

Po zavedeni tohoto rezimu ma platit:

1. FE task zacina bez nutnosti znovu dohledavat backend,
2. agent dostane presnou vstupni pravdu o BE surface z packetu,
3. zmena kontraktu automaticky nuti update packetu,
4. kontextove ztraty mezi vlakny jsou mensi a levnejsi.
