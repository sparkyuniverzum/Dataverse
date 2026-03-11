# Dataverse Domain Units (V2)

## Canonical base unit

Základní jednotka systému je **Nerost/Fakt**.

- Fakt je nejmenší editovatelný údaj (`key -> typed_value`).
- Calc engine počítá nad fakty.
- Parser zapisuje do faktů (`Moon.field := value`).
- UI Grid i 3D detail pracují nad stejnou reprezentací faktů.

## Hierarchie

1. **Fakt (Nerost)**: `key`, `typed_value`, `value_type`, `source`, `status`.
2. **Měsíc (Řádek tabulky)**: identita řádku + kolekce faktů.
3. **Planeta (Tabulka)**: schema + kolekce měsíců.
4. **Souhvězdí (Logická skupina tabulek)**.
5. **Galaxie (Workspace)**.

## Implementace v kódu

- Backend:
  - `app/schemas.py`:
    - `MineralFact`
    - `MoonRowContract`
    - `build_moon_facts(...)`
    - `asteroid_snapshot_to_moon_row(...)`
  - `/universe/snapshot` vrací u asteroidů i canonical `facts`.

- Frontend:
  - `frontend/src/components/universe/workspaceContract.js`:
    - frozen FE usage pro `moon_summary` a `mineral_fact` payloady.
  - `frontend/src/lib/moonContract.js`:
    - frozen FE usage pro first-class Moon CRUD kontrakt (`/moons`).
  - `frontend/src/lib/dataverseApi.js`:
    - URL buildery pro moon CRUD endpointy a workspace snapshot flow.
