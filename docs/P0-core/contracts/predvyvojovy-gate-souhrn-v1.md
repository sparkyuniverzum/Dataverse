# Predvyvojovy gate souhrn v1

Stav: aktivni (priprava finalniho predvyvojoveho gate)
Datum: 2026-03-11
Vlastnik: Core FE/BE architektura + UX governance

## 1. Co se zmenilo

- [x] 2026-03-11 Doplnene aktivni reference v `docs/P0-core/README.md` o FE risk dokument.
- [x] 2026-03-11 Zalozen souhrnny dokument predvyvojoveho gate stavu.
- [x] 2026-03-11 Zapsan aktualni stav otevrenych checklistu aktivnich kontraktu.

## 2. Proc se to zmenilo

Potrebujeme jeden operacni souhrn, ktery rekne:

1. ktere predvyvojove kontrakty jsou uzavrene,
2. ktere kontrakty maji otevrene body,
3. co je nejblizsi minimalni cesta k finalnimu gate uzavreni.

## 3. Aktualni stav aktivnich kontraktu

## 3.1 Uzavrene (bez otevrenych checkboxu)

- [x] `canonical-ux-ontology-v1CZ.md` (`open_checkboxes=0`)
- [x] `ux-ia-navigation-architecture-v1CZ.md` (`open_checkboxes=0`)
- [x] `ux-journeys-and-visual-language-v1CZ.md` (`open_checkboxes=0`)
- [x] `ux-fe-component-behavior-contract-v1CZ.md` (`open_checkboxes=0`)
- [x] `runtime-package-map-v1CZ.md` (`open_checkboxes=0`)
- [x] `human-agent-alignment-protocol-v1.md` (`open_checkboxes=0`)

## 3.2 Otevrene (maji otevrene checkboxy)

- [ ] `backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md` (`open_checkboxes=17`)
- [ ] `backend-mvp-continuation-v1.md` (`open_checkboxes=15`)
- [ ] `ux-fe-risk-assessment-v1CZ.md` (`open_checkboxes=1`)

## 3.3 Stav struktury dokumentace

- [x] Aktivni dokumentace je vedena jako CZ-only.
- [x] EN mirrory jsou v `docs/P0-core/contracts/archive/en/`.
- [x] Aktivni index [P0-core/README.md](/mnt/c/Projekty/Dataverse/docs/P0-core/README.md) obsahuje FE risk dokument.
- [ ] Predvyvojovy gate jako celek je finalne uzavren (blokovano otevrenymi checklisty v bode 3.2).

## 4. Minimalni cesta k finalnimu gate

1. Uzavrit `backend-mvp-continuation-v1.md`:
   - doplnit evidence za `P0-1`, rozhodnout vyjimky a prepnout gate na `[x]`.
2. Uzavrit `backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md`:
   - projit domain checklist a test/gate checklist, prepnout na `[x]` pouze s evidenci.
3. Uzavrit `ux-fe-risk-assessment-v1CZ.md`:
   - potvrdit `R2/R4` viewport limity praktickym viewport smoke checkem.

## 5. Evidence

Pouzita auditni sada:

```bash
cd /mnt/c/Projekty/Dataverse
find docs/P0-core/contracts -maxdepth 5 -type f | sort
rg -n "\\[ \\]" docs/P0-core docs/P1-exec
python - <<'PY'
from pathlib import Path
active=[
'docs/P0-core/contracts/canonical-ux-ontology-v1CZ.md',
'docs/P0-core/contracts/backend-mvp-requirements-from-canonical-ux-ontology-v1CZ.md',
'docs/P0-core/contracts/backend-mvp-continuation-v1.md',
'docs/P0-core/contracts/ux-ia-navigation-architecture-v1CZ.md',
'docs/P0-core/contracts/ux-journeys-and-visual-language-v1CZ.md',
'docs/P0-core/contracts/ux-fe-component-behavior-contract-v1CZ.md',
'docs/P0-core/contracts/ux-fe-risk-assessment-v1CZ.md',
'docs/P0-core/contracts/runtime-package-map-v1CZ.md',
'docs/P0-core/governance/human-agent-alignment-protocol-v1.md',
]
for p in active:
    t=Path(p).read_text(encoding='utf-8',errors='ignore')
    print(f"{p}: open_checkboxes={t.count('- [ ]')}")
PY
```

## 6. Otevrene polozky

- [ ] Dopsat finalni `Gate splneno` rozhodnuti po uzavreni bodu 3.2.
