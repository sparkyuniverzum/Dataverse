# Kontrakt: Star Core Interior Orchestration

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 |
| **Vlastník** | Backend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento kontrakt definuje kanonickou backendovou vrstvu pro orchestraci interiéru hvězdy (Star Core). Cílem je centralizace workflow autority na Backend, čímž se zamezuje lokálnímu rozhodování Frontendu o stavu interiéru a zajišťuje se integrita operátorské journey.

## 2. Technická Specifikace (Orchestration Flow)
Backend garantuje autoritativní správu těchto fází interiéru:
1. `star_core_interior_entry`: Inicializace vstupu.
2. `constitution_select`: Proces volby ústavy (režimu) vesmíru.
3. `policy_lock_ready`: Validace připravenosti k uzamčení politik.
4. `policy_lock_transition`: Proces transformace a zápisu politik.
5. `first_orbit_ready`: Stav po úspěšném uzamčení, připravenost na první orbitu.

## 3. Pravidla (Governance & Registry)

### 3.1 Katalog Ústav (Constitutions)
Backend definuje a vynucuje čtyři kanonické režimy:
- **Růst (rust)**: Maximalizace propustnosti a expanze.
- **Rovnováha (rovnovaha)**: Stabilní výchozí režim (Origin).
- **Stráž (straz)**: Priorita integrity a bezpečnosti.
- **Archiv (archiv)**: Fixace dat, minimální aktivita.

Každá ústava musí být mapována na `profile_key`, `law_preset` a příslušný fyzikální profil.

### 3.2 Lock Readiness & Explainability
Backend je jedinou autoritou pro výpočet `lock_ready`. Odpověď musí obsahovat:
- Explicitní indikaci připravenosti (`boolean`).
- Seznam blokujících faktorů (`lock_blockers[]`).
- Instrukce pro další krok operátora (`next_action`).
- Kontextové vysvětlení stavu (`explainability`).

## 4. Akceptační kritéria (Hard Gates)
- [ ] Existuje kanonický read-model pro interiér hvězdy (`GET /star-core/interior`).
- [ ] Validace a výběr ústavy probíhá výhradně na straně serveru.
- [ ] Frontend neprovádí žádné odvozené výpočty stavu `lock_ready`.
- [ ] Přechod do fáze `first_orbit_ready` je podmíněn fyzickým zápisem do databáze.
- [ ] Všechny chyby v rámci transition flow jsou doprovázeny vysvětlujícím metadatem (Explainability).

## 5. Definice Rozhraní (Contract Surface)
```typescript
interface InteriorOrchestrationModel {
  interior_phase: 'entry' | 'constitution_select' | 'lock_ready' | 'lock_transition' | 'first_orbit_ready';
  available_constitutions: string[];
  selected_constitution: string | null;
  lock_ready: boolean;
  lock_blockers: string[];
  lock_transition_state: 'idle' | 'accepted' | 'locked' | 'failed';
  explainability: {
    headline_cz: string;
    body_cz: string;
  };
}
```
