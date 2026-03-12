# FE BE pravda a data guard v1

Stav: aktivni (zavazny guard pro FE data pravdu)
Datum: 2026-03-12
Vlastnik: FE architektura + BE kontrakt governance + user-agent governance

## 1. Co se zmenilo

- [x] 2026-03-12 Byl zaveden zavazny guard, jak FE hlida, ze promita backend pravdu.
- [x] 2026-03-12 Byly urceny vrstvy kontroly: contract fields, normalizace, runtime drift, projection convergence a focused testy.
- [x] 2026-03-12 Byl urcen pripraveny kod z archivu, ktery se ma pro tyto guardy vracet.

## 2. Proc to vzniklo

Po FE resetu uz nestaci navrhovat jen vizualni smer. Potrebujeme garantovat, ze novy FE:

1. stavi na realnych datech z BE,
2. neprepisuje backend pravdu lokalnim dojmem,
3. umi poznat drift mezi payloadem a FE modelem,
4. umi dokazat, ze user-visible stav odpovida canonical backend kontraktu.

## 3. Zavazny princip

Plati:

1. BE je autorita pravdy.
2. FE smi data:
   - normalizovat,
   - formatovat,
   - vysvetlovat,
   - vizualizovat.
3. FE nesmi backend pravdu domyslet, prepisovat nebo maskovat fallbackem bez explicitniho guardu.

## 4. Vrstvy kontroly

### 4.1 Contract field guard

Kazda nova FE surface, ktera cte runtime data, musi mit jasne urceno:

1. ktera BE pole cte,
2. ktera FE pole realne pouziva,
3. ktera pole jsou `USE_NOW`,
4. ktera pole jsou jen rezervovana.

Pripraveny kod z archivu:

1. `frontend/src/_inspiration_reset_20260312/components/universe/starContract.js`
2. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContract.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/workspaceContractExplainability.js`

### 4.2 Normalization guard

Kazdy payload z BE musi projit explicitni normalizaci.

Pravidla:

1. nulove a prazdne hodnoty se nesmi ztratit fallbackem,
2. `null`, `0`, `""` a chybejici pole se nesmi sloucit do jedne kategorie,
3. FE helper musi byt testovany na edge-case hodnoty.

Pripraveny kod z archivu:

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`
4. `rowWriteUtils.js`
5. `workspaceFormatters.js`

### 4.3 Runtime drift guard

Jakmile FE cte stream nebo snapshot, musi umet rozpoznat:

1. kdy je payload mimo ocekavany shape,
2. kdy normalizace odhalila podezrely drift,
3. kdy je potreba refresh nebo fallback na bezpecny stav.

Pripraveny kod z archivu:

1. `runtimeNormalizationSignal.js`
2. `runtimeDeltaSync.js`
3. `runtimeSyncUtils.js`
4. `runtimeConnectivityState.js`

### 4.4 Projection convergence guard

Pokud FE sklada lokalni projection vrstvu z eventu a snapshotu, musi umet urcit:

1. zda je projekce stale duveryhodna,
2. kdy se ma projection zahodit a znovu nacist,
3. kdy je user-visible stav stale bezpecny pro zobrazeni.

Pripraveny kod z archivu:

1. `runtimeProjectionPatch.js`
2. `projectionConvergenceGate.js`
3. `useUniverseRuntimeSync.js`

### 4.5 Explainability guard

Kdyz FE narazi na kontraktovy nebo datovy problem, musi umet rict:

1. co se nepovedlo,
2. ktere pole chybi nebo jsou rozbita,
3. zda jde o problem `contract`, `runtime`, `connectivity`, nebo `projection`.

Pripraveny kod z archivu:

1. `workspaceContractExplainability.js`
2. `contractViolationRecovery.js`
3. `repairFlowContract.js`

## 5. Povinne dokazovani v kazdem FE bloku

Pokud blok zavadi novou runtime FE surface, musi dodat:

1. `technical completion`
   - ktery helper/contract hlida BE pravdu
2. `user-visible completion`
   - jak se backend pravda promita do UI
3. `documentation completion`
   - sekci `Pripraveny kod z archivu`
   - odkaz na tento dokument
4. `gate completion`
   - focused test na normalizaci nebo kontrakt
   - a podle scope i focused test na projection/runtime chovani

## 6. Minimalni guard checklist pro implementaci

Pred implementaci runtime FE:

1. definovat payload source,
2. definovat normalizer,
3. definovat `contract diff` nebo field usage map,
4. definovat drift/convergence reakci,
5. definovat focused testy.

Bez teto pětice se runtime FE blok nepovazuje za pripraveny.

## 7. Pripraveny kod z archivu

Pro navazujici FE bloky je pripraveno:

1. `starContract.js`
2. `workspaceContract.js`
3. `workspaceContractExplainability.js`
4. `lawResolver.js`
5. `planetPhysicsParity.js`
6. `runtimeNormalizationSignal.js`
7. `runtimeDeltaSync.js`
8. `runtimeProjectionPatch.js`
9. `runtimeSyncUtils.js`
10. `runtimeConnectivityState.js`
11. `projectionConvergenceGate.js`
12. `useUniverseRuntimeSync.js`

Tyto moduly se maji vracet postupne podle FE bloku, ne najednou.

## 8. Kdy se co vraci

### FE-R1

Pouzit:

1. `starContract.js`
2. `lawResolver.js`
3. `planetPhysicsParity.js`
4. podle potreby `workspaceStateContract.js`

Cil:

1. governance-first first view stoji na realne `Star Core` pravde

### FE-R2

Pouzit:

1. `runtimeNormalizationSignal.js`
2. `runtimeSyncUtils.js`
3. `runtimeDeltaSync.js`
4. `runtimeProjectionPatch.js`
5. `useUniverseRuntimeSync.js`

Cil:

1. workspace zacne cist a bezpecne promítat runtime

### FE-R3

Pouzit:

1. `workspaceContract.js`
2. `workspaceContractExplainability.js`
3. `projectionConvergenceGate.js`
4. `runtimeConnectivityState.js`
5. `repairFlowContract.js`

Cil:

1. operation vrstva bude umet dokazat, ze pracuje nad backend pravdou a umi vysvetlit odchylky

## 9. Evidence

Minimalni dukaz tohoto guard dokumentu:

```bash
cd /mnt/c/Projekty/Dataverse
rg -n \"workspaceContract|workspaceContractExplainability|starContract|runtimeNormalizationSignal|runtimeProjectionPatch|projectionConvergenceGate|useUniverseRuntimeSync\" frontend/src/_inspiration_reset_20260312/components/universe
```

Vysledek:

- [x] 2026-03-12 Pripraveny archived kod pro contract/data guard byl potvrzen.
- [x] 2026-03-12 Guard vrstvy byly rozdeleny na contract, normalizaci, drift, convergence a explainability.

## 10. Co zustava otevrene

- [ ] Po navrhu `FE-R1` zapsat do konkretniho implementacniho dokumentu, ktere guard moduly se vraci v prvnim runtime bloku.
- [ ] Po prvnim runtime FE bloku dodat focused testy, ktere potvrdi, ze FE promita backend pravdu bez drift fallbacku.
