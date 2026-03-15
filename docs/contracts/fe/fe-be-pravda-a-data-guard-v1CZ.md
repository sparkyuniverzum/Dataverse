# Kontrakt: FE-BE Data Guard & Pravda

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 (Profesionální Revize) |
| **Vlastník** | Frontend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument stanovuje závazná pravidla pro manipulaci s daty na Frontendu. Cílem je zajistit, aby FE vždy věrně promítal stav Backend (BE) jako jediné autority pravdy a eliminoval neřízené lokální odchylky (data drift).

## 2. Základní Principy
1. **BE je autorita pravdy**: FE nesmí domýšlet chybějící data nebo maskovat chyby BE neautorizovanými fallbacky.
2. **Explicitní transformace**: Veškerá data z BE musí projít definovanou vrstvou normalizace a formátování.
3. **Detekce driftu**: FE musí aktivně rozpoznat, pokud se user-visible stav odchýlil od kanonického kontraktu.

## 3. Vrstvy Kontroly (Guards)

### 3.1 Contract Field Guard
Každá komponenta čtoucí runtime data musí explicitně definovat:
- **BE Pole**: Která pole z API kontraktu jsou vyžadována.
- **Mapping**: Jak jsou pole mapována do vnitřního stavu FE.
- **Usage**: Rozlišení mezi `USE_NOW` (aktivní v UI) a `RESERVED` (příprava pro budoucí funkce).

### 3.2 Normalization Guard
Normalizační vrstva nesmí způsobovat ztrátu informace:
- Hodnoty `null`, `0`, `""` nesmí být sloučeny do jedné kategorie bez explicitního pravidla.
- Edge-case hodnoty musí být ošetřeny v normalizačních testech.

### 3.3 Runtime Drift & Connectivity Guard
FE musí v reálném čase monitorovat integritu spojení a dat:
- **Drift Detection**: Signalizace nesouladu mezi snapshotem a delta streamem.
- **Refresh Policy**: Automatické vynucení nového snapshotu při ztrátě konvergence.
- **Connectivity State**: Jasná vizualizace stavu spojení (Synced, Out of Sync, Reconnecting).

### 3.4 Projection Convergence Guard
Pokud FE skládá lokální projekci (např. v 3D scéně):
- Musí existovat mechanismus pro ověření, že lokální render odpovídá BE stavu.
- Při detekci nekonvergentního stavu musí být projekce zahozena a inicializována znovu.

## 4. Akceptační kritéria (Hard Gates)
- [ ] Každý nový runtime modul obsahuje dedikovaný `ContractHelper` nebo `Adapter`.
- [ ] Existují Unit testy pro normalizaci dat pokrývající edge-cases.
- [ ] UI obsahuje vizuální indikaci "Data Integrity" (např. v debug režimu nebo skrze Explainability overlay).
- [ ] Systém neumí přejít do stavu "Úspěšně uloženo" bez explicitního potvrzení z BE (žádný čistě optimistický UI commit pro kritická governance data).
