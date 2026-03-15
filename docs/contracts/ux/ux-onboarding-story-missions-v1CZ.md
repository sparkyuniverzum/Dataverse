# Kontrakt: UX Onboarding Story Mise

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 (Profesionální Revize) |
| **Vlastník** | Produktové UX / FE Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Definovat onboarding jako řízenou "expedici", která uživatele seznámí s ontologií Dataverse a klíčovými pracovními postupy, aniž by blokovala operativní efektivitu. Onboarding neslouží jako povinný tutoriál, ale jako diegetický úvod do role operátora.

## 2. Základní Pravidla a Omezení
1. **Dostupnost**: Core workflow musí být dostupné okamžitě. Tlačítko `Skip Onboarding` je aktivní od první sekundy.
2. **Parita**: Režim "Reduce Motion" musí zachovat plnou funkční a informační paritu.
3. **Ontologická integrita**: Onboarding nesmí zkreslovat význam entit (např. Civilizace = řádek/data, Měsíc = schopnost/modul).
4. **Nezávislost**: Onboarding neupravuje runtime pravidla, pouze metodu jejich prezentace.

## 3. Struktura Misí (M0 - M6)
- **M0 (Letový plán)**: Personalizace identity operátora (není to herní profil, ale identita v systému).
- **M1 (Přílet)**: Cinematic přechod `Nexus -> Workspace`. Kamera končí v přehledové pozici.
- **M2 (Governance)**: První interakce s hvězdou, volba ústavy a provedení `Policy Lock`.
- **M3 (Data Structure)**: Umístění první planety (kontejneru pro data).
- **M4 (Data Entry)**: Vytvoření první civilizace skrze Grid (primární pracovní plocha).
- **M5 (Data Mutation)**: První editace minerálu (hodnoty), ověření validačních reakcí.
- **M6 (Capability)**: Připojení prvního měsíce a pochopení rozšíření schopností planety.

## 4. Systém nápovědy a odhalování (Hint Ladder)
1. **Teaser**: "Detekován signál" (nenápadná indikace).
2. **Sektor**: Zvýraznění oblasti v Minimapě.
3. **CTA**: Přímá navigace k akci (pouze u kritických kroků).

## 5. Výkonnostní Limity
- **Povinná část**: Max 3 minuty.
- **Celková expedice**: 4-6 minut.
- **Time-to-first-edit**: <= 4.5 s (p95) od vstupu do systému.

## 6. Akceptační kritéria (Hard Gates)
- [ ] Funkce `Skip` okamžitě ukončuje veškeré cinematic sekvence a vrací uživatele do `NORMAL` módu.
- [ ] Onboarding používá identickou terminologii jako `Command Bar` a `Grid`.
- [ ] Každá mise má jasně definovaný cíl, signál úspěchu a navazující krok.
- [ ] Žádný krok mise není "dead-end" (vždy existuje cesta zpět nebo skip).
