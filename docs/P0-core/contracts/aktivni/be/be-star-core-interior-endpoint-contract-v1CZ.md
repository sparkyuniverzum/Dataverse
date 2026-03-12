# BE Star Core Interior endpoint contract v1

Stav: aktivni
Datum: 2026-03-12
Vlastnik: BE architektura + FE/UX governance + user-agent alignment

## 1. Co se zmenilo

Tento dokument rozpadava zadani [be-star-core-interior-orchestration-zadani-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md) do:

1. presne contract surface,
2. request/response poli,
3. stavovych prechodu,
4. implementacnich kroku,
5. tvrdych gate pro BE realizaci.

## 2. Proc to vzniklo

Puvodni zadani uz potvrdilo, ze `Blok 3` nemuze zustat na FE jako workflow autorita.

Chybela ale presna odpoved na:

1. ktere endpointy zustanou,
2. ktere endpointy pribudou,
3. jaka pole budou canonical,
4. co je read model a co je command,
5. kdy je lock pripraveny,
6. kdy je stav `first_orbit_ready`.

Tento dokument tuhle mezeru zavira.

## 3. Navrzeny contract surface

### 3.1 Read model

Zavest novy read endpoint:

1. `GET /galaxies/{galaxy_id}/star-core/interior`

Ucel:

1. canonical pravda pro workflow interieru,
2. read model pro FE `Blok 3`,
3. bez nutnosti, aby FE skladal workflow z `policy + physics + runtime`.

### 3.2 Constitution command

Zavest novy explicitni command endpoint:

1. `POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`

Ucel:

1. canonical vyber ustavy,
2. server-side validace,
3. priprava `policy_lock_ready`,
4. explainability proc je nebo neni lock povoleny.

### 3.3 Policy lock command

Zachovat canonical command:

1. `POST /galaxies/{galaxy_id}/star-core/policy/lock`

Pravidlo:

1. endpoint zustava autoritou pro skutecne uzamceni,
2. ale od ted musi byt semanticky napojeny na `interior` orchestration stav,
3. po uspesnem locku musi jit zpet cist `first_orbit_ready` pres `GET /star-core/interior`.

## 4. Canonical interior read model

### 4.1 Response shape

`GET /galaxies/{galaxy_id}/star-core/interior` ma vracet canonical payload:

```json
{
  "galaxy_id": "uuid",
  "interior_phase": "constitution_select",
  "available_constitutions": [
    {
      "constitution_id": "rovnovaha",
      "title_cz": "Rovnovaha",
      "summary_cz": "Stabilni univerzalni rezim.",
      "profile_key": "ORIGIN",
      "law_preset": "balanced",
      "physical_profile_key": "BALANCE",
      "physical_profile_version": 1,
      "visual_tone": "balanced_blue",
      "pulse_hint": "steady",
      "recommended": true,
      "lock_allowed": true
    }
  ],
  "selected_constitution_id": "rovnovaha",
  "recommended_constitution_id": "rovnovaha",
  "lock_ready": true,
  "lock_blockers": [],
  "lock_transition_state": "idle",
  "first_orbit_ready": false,
  "next_action": {
    "action_key": "confirm_policy_lock",
    "label_cz": "Potvrdit ustavu a uzamknout politiky"
  },
  "explainability": {
    "headline_cz": "Ustava je pripravena k uzamceni.",
    "body_cz": "Po uzamceni se potvrdi governance zaklad a vznikne prvni obezna draha."
  },
  "source_truth": {
    "policy_lock_status": "draft",
    "policy_version": 3,
    "profile_key": "ORIGIN",
    "law_preset": "balanced",
    "physical_profile_key": "BALANCE",
    "physical_profile_version": 1
  }
}
```

### 4.2 Povinna pole

Povinna pole read modelu:

1. `galaxy_id`
2. `interior_phase`
3. `available_constitutions[]`
4. `selected_constitution_id`
5. `recommended_constitution_id`
6. `lock_ready`
7. `lock_blockers[]`
8. `lock_transition_state`
9. `first_orbit_ready`
10. `next_action`
11. `explainability`
12. `source_truth`

### 4.3 Povoleny `interior_phase`

Canonical hodnoty:

1. `star_core_interior_entry`
2. `constitution_select`
3. `policy_lock_ready`
4. `policy_lock_transition`
5. `first_orbit_ready`

Zakaz:

1. FE nesmi zavest dalsi finalni workflow faze bez BE kontraktu,
2. FE nesmi sam odvozovat `policy_lock_ready`.

### 4.4 Povoleny `lock_transition_state`

Canonical hodnoty:

1. `idle`
2. `request_accepted`
3. `locked`
4. `failed`

Semantika:

1. `idle` = lock jeste nebezi,
2. `request_accepted` = command byl prijat, ale jeste neni canonical `locked`,
3. `locked` = policy truth je potvrzena jako `locked`,
4. `failed` = lock neprosel a FE musi dostat explainability.

## 5. Constitution catalog

BE musi drzet canonical katalog ctyr ustav.

### 5.1 Rust

1. `constitution_id`: `rust`
2. `title_cz`: `Růst`
3. `profile_key`: `FLUX`
4. `law_preset`: `high_throughput`
5. `physical_profile_key`: `FORGE`
6. `physical_profile_version`: `1`

### 5.2 Rovnovaha

1. `constitution_id`: `rovnovaha`
2. `title_cz`: `Rovnováha`
3. `profile_key`: `ORIGIN`
4. `law_preset`: `balanced`
5. `physical_profile_key`: `BALANCE`
6. `physical_profile_version`: `1`

### 5.3 Straz

1. `constitution_id`: `straz`
2. `title_cz`: `Stráž`
3. `profile_key`: `SENTINEL`
4. `law_preset`: `integrity_first`
5. `physical_profile_key`: `BALANCE`
6. `physical_profile_version`: `1`

### 5.4 Archiv

1. `constitution_id`: `archiv`
2. `title_cz`: `Archiv`
3. `profile_key`: `ARCHIVE`
4. `law_preset`: `low_activity`
5. `physical_profile_key`: `ARCHIVE`
6. `physical_profile_version`: `1`

Pravidlo:

1. FE smi pouzit jen to, co prijde z BE read modelu,
2. FE nesmi drzet vlastni canonical mapu ustav jako finalni pravdu.

## 6. Constitution select command

### 6.1 Request

`POST /galaxies/{galaxy_id}/star-core/interior/constitution/select`

```json
{
  "constitution_id": "rovnovaha",
  "idempotency_key": "uuid-or-client-key"
}
```

### 6.2 Response

Response ma vratit aktualizovany interior read model stejného tvaru jako `GET /star-core/interior`.

Minimalni povinnost:

1. `selected_constitution_id` odpovida potvrzene volbe,
2. `lock_ready` je server-side rozhodnuty,
3. `lock_blockers[]` vysvetli, co chybi,
4. `next_action` rika dalsi operator krok.

### 6.3 Error codes

Minimalni canonical chyby:

1. `STAR_CORE_CONSTITUTION_INVALID`
2. `STAR_CORE_CONSTITUTION_NOT_ALLOWED`
3. `STAR_CORE_POLICY_ALREADY_LOCKED`
4. `STAR_CORE_INTERIOR_NOT_AVAILABLE`

## 7. Policy lock command napojeni

### 7.1 Request

Existujici payload zustava:

```json
{
  "profile_key": "ORIGIN",
  "physical_profile_key": "BALANCE",
  "physical_profile_version": 1,
  "lock_after_apply": true,
  "idempotency_key": "uuid-or-client-key"
}
```

### 7.2 Pravidlo skladani payloadu

Backend musi umi potvrdit, ze:

1. `profile_key`
2. `physical_profile_key`
3. `physical_profile_version`

odpovidaji canonical `selected_constitution_id`.

Zakaz:

1. FE nesmi byt jedinym strazcem tehle shody.

### 7.3 Response a navaznost

Response endpointu `policy/lock` muze zustat `StarCorePolicyPublic`, ale BE musi po uspesnem commandu zaroven zajistit, ze:

1. `GET /star-core/interior` vrati `lock_transition_state = "locked"`,
2. `interior_phase = "first_orbit_ready"`,
3. `first_orbit_ready = true`,
4. `next_action` ukazuje dalsi prostorovy krok.

## 8. Stavove prechody

Canonical workflow:

1. `star_core_interior_entry -> constitution_select`
2. `constitution_select -> policy_lock_ready`
3. `policy_lock_ready -> policy_lock_transition`
4. `policy_lock_transition -> first_orbit_ready`

Mozne odchylky:

1. `constitution_select -> constitution_select`
   pri zmene vyberu nebo blockeru
2. `policy_lock_ready -> constitution_select`
   pokud se volba zmeni
3. `policy_lock_transition -> policy_lock_ready`
   pokud lock selze obnovitelne

Zakaz:

1. `first_orbit_ready` nesmi vzniknout jen z FE optimismu,
2. `policy_lock_transition` nesmi byt jen lokalni animacni domnenka bez BE potvrzeni.

## 9. Presne implementacni kroky na BE

### 9.1 Krok A: schema a public model

1. doplnit nove Pydantic schema pro interior read model,
2. doplnit schema pro constitution select command,
3. sjednotit naming do `app/schema_models/star_core.py`.

### 9.2 Krok B: constitution catalog

1. zavest canonical server-side katalog 4 ustav,
2. drzet mapovani `constitution_id -> profile/policy/physics`,
3. pridat explainability metadata pro FE.

### 9.3 Krok C: read query

1. implementovat query `get_star_core_interior(...)`,
2. skladat ji nad existujici `policy`, `physics`, `runtime`, `pulse`, `domain metrics`,
3. vracet `interior_phase`, `lock_ready`, `lock_blockers`, `next_action`.

### 9.4 Krok D: select command

1. implementovat `select_star_core_constitution(...)`,
2. validovat vyber,
3. vratit aktualizovany interior read model,
4. podporit `idempotency_key`.

### 9.5 Krok E: lock orchestration

1. napojit `policy/lock` na selected constitution,
2. po successful locku prepocitat interior read model,
3. vratit `first_orbit_ready`.

### 9.6 Krok F: error a explainability

1. zavedeni canonical `code`,
2. operator-readable `message`,
3. `explainability` pro FE bez domysleni.

## 10. Hard gate

Tento BE blok se nesmi oznacit za uzavreny, pokud:

1. neexistuje `GET /galaxies/{galaxy_id}/star-core/interior`,
2. neexistuje explicitni `constitution/select` command,
3. FE stale musi skladat `policy_lock_ready` sam,
4. `selected_constitution_id` neni canonical server-side pravda,
5. neni jasne odliseno `request_accepted` vs `locked`,
6. `first_orbit_ready` nevznika z BE potvrzeni.

## 11. Evidence a navaznost

Tento dokument vykonava:

1. [be-star-core-interior-orchestration-zadani-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/be/be-star-core-interior-orchestration-zadani-v1CZ.md)

Na tento dokument primo navazuje:

1. [be-star-core-interior-implementacni-dokument-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/be/be-star-core-interior-implementacni-dokument-v1CZ.md)

Tento dokument je primy blocker/dependency pro:

1. [fe-blok-3-implementacni-dokument-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/fe/fe-blok-3-implementacni-dokument-v1CZ.md)
2. [fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md](/mnt/c/Projekty/Dataverse/docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md)
