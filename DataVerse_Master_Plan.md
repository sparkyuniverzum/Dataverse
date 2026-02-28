# DataVerse: Technický Manifest a Master Plan v1.0

## 1. Filozofie a základní zákony systému
DataVerse není tabulkový procesor, je to deterministický, atomární datový vesmír navržený jako nástupce tradičních tabulek (Excelu). Provoz systému se řídí následujícími nezměnitelnými zákony:

* **Zákon atomarity**: Základní jednotkou informace je **Atom**. Neexistují pevné tabulky, pouze shluky atomů spojené silami (Bonds).
* **Zákon zachování (Immortality)**: V systému je přísně zakázán HARD DELETE [cite: 1]. Informace nikdy nezaniká, pouze mění stav na neaktivní (Soft Delete).
* **Zákon determinismu**: Veškeré ovládání probíhá přes **Triple-Shot Parser** ve formátu: `[Akce] | [Objekt] | [Podmínka]`.
* **Zákon času**: Čas je čtvrtou dimenzí. Díky verzování atomů lze v systému cestovat historií (Temporal Logic).

---

## 2. Technická Architektura
* **Backend**: Python 3.10+ (FastAPI)
* **Databáze**: PostgreSQL 14+ (pro grafové operace a auditní logiku)
* **Frontend**: 3D vizualizační engine (Three.js / React Three Fiber)

---

## 3. Databázové Schéma (SQL)
Toto schéma implementuje fyzikální bariéru proti smazání dat.

```sql
-- Ochrana proti HARD DELETE
CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'HARD DELETE is forbidden in DataVerse. Use soft-delete.';
END;
$$ LANGUAGE plpgsql;

-- Tabulka ATOMS (Částice)
CREATE TABLE atoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT atoms_soft_delete_chk CHECK (
        (is_deleted = FALSE AND deleted_at IS NULL) OR
        (is_deleted = TRUE AND deleted_at IS NOT NULL)
    )
);

CREATE TRIGGER trg_atoms_no_delete BEFORE DELETE ON atoms
FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

-- Tabulka BONDS (Vazby)
CREATE TABLE bonds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES atoms(id),
    target_id UUID NOT NULL REFERENCES atoms(id),
    type TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT bonds_no_delete_chk CHECK (source_id <> target_id)
);

CREATE TRIGGER trg_bonds_no_delete BEFORE DELETE ON bonds
FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
```

---

## 4. Roadmapa vývoje

### Fáze 1: Stabilní Singularita (Foundation)
* Implementace základního schématu v PostgreSQL.
* Vývoj FastAPI endpointu pro tvorbu atomů s kontrolou duplicity.
* Zavedení audit logu pro sledování každé změny.

### Fáze 2: Formování Molekul (Relations)
* Logika pro vytváření a správu vazeb (Bonds).
* Algoritmy pro detekci "sémantické gravitace" (automatické shlukování podobných dat).
* API pro traversování grafu (hledání souvislostí).

### Fáze 3: Triple-Shot Engine (Interface)
* Deterministický parser pro český přirozený jazyk.
* Mapování akcí (Ukaž, Smaž, Spoj) na SQL/Command modely.
* Vizuální HUD pro bar na psaní.

### Fáze 4: Vizuální rezonance (Visualization)
* Real-time synchronizace přes WebSockets.
* Implementace Time-Travel slideru (pohled na vesmír v čase T).
* Shader efekty pro "duchy" (smazaná data).

---
*Dokument vygenerován systémem Gemini pro projekt DataVerse - 2026*
