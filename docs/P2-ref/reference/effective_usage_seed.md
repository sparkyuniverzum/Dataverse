# Effective Usage Seed (v1)

Tento seed vytvori prakticky workspace flow pro rychle testovani:

- `Finance > Cashflow`
- `Operace > Sklad`
- `Lide > Zamestnanci`

Obsah:

- mesice `Prijmy`, `Vydaje`, `Rezerva` + `FLOW` vazby
- mesice skladu `Srouby`, `Hrebiky`, `Desky`
- mesice lidi `Erik`, `Eva`, `Petr` + `RELATION` vazby na sklad
- formula: `Rezerva.saldo = SUM(castka)` (z incoming `FLOW`)
- guardians:
  - `Rezerva.saldo < 3000 -> cash_warning`
  - `Desky.mnozstvi < 150 -> restock_warning`

## Spusteni seedu

```bash
python scripts/seed_effective_usage.py
```

## Efektivni pouziti v UI (rychly scenar)

1. Otevri galaxii s nasazenym seedem.
2. V L2 klikni planetu `Cashflow`.
3. Otevri `/grid` a zmen `Prijmy.castka` nebo `Vydaje.castka`.
4. Potvrd `Commit batch`.
5. Zkontroluj `Rezerva.saldo` (calc) a alert `cash_warning`.
6. Vrat se do 3D (`/3d`) a sleduj zmenu stavu uzlu/vazeb.
7. V panelu `Sklad` sniz `Desky.mnozstvi` pod `150` a over guardian alert.
