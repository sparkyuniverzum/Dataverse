# Kontrakt: Parser Alias Learning a Event Preview

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Runtime Parser / FE Command UX |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje standard pro inteligentní zpracování příkazů, včetně uživatelských aliasů a vysvětlitelného preview (explainability) před provedením akce. Cílem je zajistit deterministické chování příkazové řádky, auditovatelnost změn a ochranu před nechtěnými mutacemi dat.

## 2. Správa Aliasů
Aliasy umožňují mapovat uživatelské fráze na kanonické příkazy.
- **Scope**:
    - `personal`: Platí pro konkrétního uživatele v rámci galaxie.
    - `workspace`: Sdílené v rámci galaxie (vyžaduje governance roli).
- **Resoluce**: Pořadí hledání: `Personal Alias` -> `Workspace Alias` -> `Kanonický Lexikon`.
- **Zákaz**: Nelze přepisovat rezervovaná slova, měnit ontologii systému nebo vytvářet duplicitní fráze ve stejném scope.

## 3. Explainability Pipeline (Event Preview)
Každý příkaz musí projít pětistupňovým procesem:
1. **Compose**: Zadání příkazu uživatelem.
2. **Resolve**: Převod na kanonický příkaz.
3. **Plan**: Parser vytvoří atomický plán úloh (`atomic_tasks`).
4. **Explain**: Systém zobrazí predikované události (`expected_events`) a lidsky srozumitelné vysvětlení (`because_chain`).
5. **Commit**: Provedení akce až po explicitním potvrzení uživatelem.

## 4. Preview Payload a Bezpečnost
Preview odpověď musí obsahovat:
- `resolved_command`: Výsledný kanonický příkaz.
- `expected_events`: Typy událostí, které budou zapsány.
- `because_chain`: Povinné lidské zdůvodnění pro každou mutaci.
- `risk_flags`: Indikace destruktivních nebo rozsáhlých změn.
- `preview_token`: Podepsaný token pro následné spuštění (`execute`).

*Při zapnutém režimu `ENFORCED` jsou mutace bez validního preview tokenu blokovány.*

## 5. Akceptační kritéria (Hard Gates)
- [ ] Žádná mutace neproběhne bez předchozího preview a `because_chain`.
- [ ] Aliasy neobcházejí kanonická pravidla API a jsou plně auditovatelné.
- [ ] Systém detekuje a reportuje konflikty aliasů dříve, než dojde k jejich uložení.
- [ ] Preview token má definovanou expiraci a je vázán na konkrétního uživatele a scope.
- [ ] Existují integrační testy pokrývající celý pipeline od aliasu po execute.

## 6. API Rozhraní
- `GET /parser/lexicon`: Seznam kanonických CZ povelů.
- `GET/PUT/DELETE /parser/aliases`: Správa uživatelských aliasů.
- `POST /parser/preview`: Generování plánu a preview tokenu (bez zápisu).
- `POST /parser/execute`: Provedení plánu s validací tokenu.
