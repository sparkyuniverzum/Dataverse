# FE reset ramec v1

Stav: aktivni (zavazny FE restart ramec)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-12 Aktivni authenticated FE runtime byl resetovan na minimalisticky zaklad.
- [x] 2026-03-12 Login flow zustal aktivni beze zmeny produktove role.
- [x] 2026-03-12 Stary workspace/universe FE byl presunut do inspiracni archivni cesty `frontend/src/_inspiration_reset_20260312/`.
- [x] 2026-03-12 Novy aktivni workspace byl zjednodusen na cistou vesmirnou plochu bez legacy panelu, gridu a onboarding surface.

## 2. Proc k resetu doslo

Predchozi FE smer se ukazal jako provozne i produktove nevyhovujici:

1. first-view experimenty neprinesly presvedcivy user-visible posun,
2. aktivni workspace byl pretizeny paralelnimi surface a legacy vrstvami,
3. dalsi iterace nad stavajicim stromem by zhorsovaly orientaci misto skutecneho noveho zacatku,
4. projekt stoji na kvalite FE a proto bylo rozhodnuto o vedomem restartu aktivniho authenticated shellu.

Tento dokument meni ramec vyvoje:

1. neprobihaji dalsi lokalni kosmeticke opravy stareho runtime FE,
2. novy FE se sklada znovu od cisteho zakladu,
3. starsi FE slouzi pouze jako inspirace, ne jako aktivni implementacni pravda.

## 3. Aktivni FE pravda po resetu

Aktivni FE ted tvori pouze:

1. login experience:
   - `frontend/src/components/app/AuthExperience.jsx`
   - `frontend/src/components/screens/LandingDashboard.jsx`
2. minimalisticky authenticated shell:
   - `frontend/src/App.jsx`
   - `frontend/src/components/app/WorkspaceShell.jsx`
   - `frontend/src/components/universe/UniverseWorkspace.jsx`

Aktivni workspace po loginu zobrazuje pouze:

1. cernou plochu,
2. hvezdne pozadi,
3. jemny centralni zarny fokus,
4. nic dalsiho.

To je zamer, ne chyba.

## 4. Archivovana FE inspirace

Puvodni authenticated FE runtime byl odsunuty do:

- `frontend/src/_inspiration_reset_20260312/`

Tato cesta je:

1. inspiracni archiv,
2. neaktivni implementacni zdroj,
3. zakazana jako zdroj pro neuvazene vraceni jednotlivych panelu nebo flow.

Zavazny postup prace s archivem:

1. nejdriv porada nad archivem,
2. u kazde polozky zapis `OK / NOK / proc / co prevzit / co odstranit`,
3. az po odsouhlaseni davky muze nasledovat navrh a teprve potom implementace,
4. `NOK` polozky se po schvalene davce odstranuji definitivne.

Pokud se ma cokoliv vracet z archivu, musi to projit:

1. novym navrhem,
2. explicitnim zdovodnenim user-visible prinosu,
3. samostatnym schvalenym FE blokem.

## 5. Novy ramec FE vyvoje

Predchozi `Slice 1 / Slice 2 / Slice 3 / Slice 4` plan je pro aktivni runtime pozastaven.

Od tohoto resetu plati nove poradi:

## 5.1 FE-R0: Clean foundation

Cil:
Potvrdit, ze aktivni authenticated FE je cisty zaklad bez legacy provozniho balastu.

Scope:

1. login zustava funkcni,
2. authenticated shell je minimalisticky,
3. stary workspace runtime neni aktivni,
4. inspiracni archiv je oddelen od aktivni cesty.

## 5.2 FE-R1: New first-view concept

Cil:
Navrhnout od nuly prvni aktivni user-visible koncept workspace po loginu.

Musi odpovedet na:

1. co uzivatel vidi jako prvni,
2. co je prvni wow moment,
3. co je prvni operacni hodnota,
4. jaka je jedna autoritativni primarni akce.

## 5.3 FE-R2: Core interaction skeleton

Cil:
Postavit prvni skutecnou interakcni kostru nad novym first-view konceptem.

Mimo scope:

1. plny legacy grid restore,
2. stare multiflow orchestrace,
3. rychle vratky panelu bez nove architektury.

## 5.4 FE-R3: Guided operation layer

Cil:
Az po potvrzeni nove first-view a kostry interakci definovat novou operation vrstvu.

## 5.5 FE-R4: Advanced workflows

Cil:
Onboarding, parser, slozitejsi workflow, governance a dalsi pokrocile surface se vraceji az po potvrzeni jadra.

## 6. Hard-stop pravidla po resetu

Nasledujici kroky jsou po resetu zakazane:

1. vracet stare FE panely po jednom jen proto, ze "uz existuji",
2. vydavat inspiracni archiv za aktivni implementacni zdroj,
3. pridavat paralelni surface bez jedne autoritativni first-view hierarchie,
4. tvrdit FE pokrok bez viditelneho user-facing rozdilu,
5. obnovovat operation layer driv, nez bude schvaleny novy first-view koncept.
6. preskocit archivni audit a jit rovnou do FE implementace.

## 7. Dukazni evidence resetu

Povinna evidence tohoto bloku:

```bash
cd /mnt/c/Projekty/Dataverse
npm --prefix frontend run test -- src/App.test.jsx src/components/app/AppConnectivityNotice.test.jsx src/components/app/appConnectivityNoticeState.test.js src/components/app/WorkspaceShell.test.jsx src/components/universe/UniverseWorkspace.test.jsx
npm --prefix frontend run build
git status --short frontend/src/App.jsx frontend/src/components/app frontend/src/components/universe frontend/src/_inspiration_reset_20260312 frontend/src/hooks frontend/src/store
```

Vysledek:

- [x] 2026-03-12 Aktivni FE test suite byla resetovana na minimalni pokryti login + connectivity notice + workspace shell + minimalisticky workspace.
- [x] 2026-03-12 `npm --prefix frontend run build` -> `built in 15.27s`
- [x] 2026-03-12 Aktivni runtime FE soubory jsou zjednodusene a legacy universe/app shell soubory jsou presunute do `frontend/src/_inspiration_reset_20260312/`.

Aktivni FE test baseline po resetu:

1. `frontend/src/App.test.jsx`
2. `frontend/src/components/app/AppConnectivityNotice.test.jsx`
3. `frontend/src/components/app/appConnectivityNoticeState.test.js`
4. `frontend/src/components/app/WorkspaceShell.test.jsx`
5. `frontend/src/components/universe/UniverseWorkspace.test.jsx`

## 7.1 Technicky reuse podklad z archivu

K resetu nově patri i aktivni technicky reuse podklad:

1. `docs/P0-core/contracts/fe-archivni-technical-inventory-a-reuse-map-v1CZ.md`

Tento dokument urcuje:

1. jaky pripraveny kod v archivu existuje,
2. kam se hodi,
3. kdy se smi vratit,
4. a jake testy ho maji doprovodit.

## 8. Vztah ke starsim dokumentum

Aktivni FE reset ramec:

1. nenahrazuje kanonickou ontologii,
2. nenahrazuje UX principy v IA/journey/risk dokumentech,
3. nahrazuje predchozi aktivni implementacni poradi FE jako bezprostredni vykonavaci plan.

Predchozi FE slice dokument:

1. je historicky pro puvodni smer,
2. neni uz zavaznym aktivnim vykonavacim planem,
3. zustava pouze jako stopa pred-reset rozhodovani.

## 9. Povinna poznamka pro dalsi implementacni dokumenty

Kazdy dalsi aktivni FE implementacni dokument po resetu musi obsahovat sekci:

1. `Pripraveny kod z archivu`

V teto sekci musi byt zapsano:

1. ktere archived helpery nebo controllery jsou pro dany blok pripraveny,
2. zda se pouziji hned, nebo az v pozdejsim bloku,
3. jaky focused test navrat potvrdi.
