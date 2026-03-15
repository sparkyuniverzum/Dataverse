# Kontrakt: Star Core Interior API (Orchestrace)

| Metadata | Hodnota |
| :--- | :--- |
| **Status** | AKTIVNÍ |
| **Verze** | 2.0 (Profesionální Revize) |
| **Vlastník** | Backend Architektura |
| **Poslední změna** | 2026-03-15 |

## 1. Účel Kontraktu
Tento dokument definuje závazné rozhraní pro orchestraci vnitřního prostoru hvězdy (Star Core Interior). Zajišťuje, že Backend je jedinou autoritou pro workflow fáze (Governance), zatímco Frontend slouží jako projekční a prováděcí vrstva.

## 2. API Definice (Endpoints)

### 2.1 Interior Read Model
`GET /galaxies/{galaxy_id}/star-core/interior`
- **Popis**: Vrací kánonickou pravdu o stavu interiéru hvězdy.
- **Payload (Response)**:
```typescript
interface InteriorReadModel {
  galaxy_id: string; // UUID
  interior_phase: 'star_core_interior_entry' | 'constitution_select' | 'policy_lock_ready' | 'policy_lock_transition' | 'first_orbit_ready';
  available_constitutions: Constitution[];
  selected_constitution_id: string | null;
  recommended_constitution_id: string;
  lock_ready: boolean;
  lock_blockers: string[];
  lock_transition_state: 'idle' | 'request_accepted' | 'locked' | 'failed';
  first_orbit_ready: boolean;
  next_action: {
    action_key: string;
    label_cz: string;
  };
  explainability: {
    headline_cz: string;
    body_cz: string;
  };
}
```

### 2.2 Entry Command
`POST /galaxies/{galaxy_id}/star-core/interior/entry/start`
- **Popis**: Inicializuje proces vstupu do interiéru.
- **Request**: `{ idempotency_key: string }`
- **Response**: `InteriorReadModel`

### 2.3 Constitution Selection
`POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`
- **Popis**: Volba ústavy vesmíru.
- **Request**: `{ constitution_id: string, idempotency_key: string }`
- **Response**: `InteriorReadModel`

### 2.4 Policy Lock
`POST /galaxies/{galaxy_id}/star-core/policy/lock`
- **Popis**: Finální uzamčení pravidel.
- **Response**: `InteriorReadModel` (s fází `policy_lock_transition` nebo `first_orbit_ready`)

## 3. Katalog Ústav (Constitutions)
Backend garantuje existenci a metadata těchto režimů:
1. **Růst (rust)**: Vysoká propustnost, zaměřeno na expanzi.
2. **Rovnováha (rovnovaha)**: Stabilní výchozí režim (Origin).
3. **Stráž (straz)**: Důraz na integritu a bezpečnost.
4. **Archiv (archiv)**: Nízká aktivita, fixace dat.

## 4. Stavový Automat (Workflow)
Povoluné přechody fází:
1. `entry` -> `constitution_select`
2. `select` -> `lock_ready`
3. `lock_ready` -> `lock_transition`
4. `lock_transition` -> `first_orbit_ready`

## 5. Akceptační kritéria (Hard Gates)
- [ ] Endpoint `/star-core/interior` vrací kompletní schéma bez chybějících polí.
- [ ] Validace ústavy probíhá výhradně na Serveru.
- [ ] Frontend nesmí vypočítávat `lock_ready` lokálně.
- [ ] Přechod na `first_orbit_ready` je možný až po fyzickém zápisu do DB.
