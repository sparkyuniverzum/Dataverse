# FE kamera a radar interaction detail v1

Stav: splneno (detailni priprava pouzita pro uzavreny Blok 1)
Datum: 2026-03-12
Vlastnik: Produktove UX + FE architektura + user-agent governance

Pouzito v:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`

## 1. Co se zmenilo

- [x] 2026-03-12 Byl zapsan detailni interaction dokument pro kameru, pohyb a radar.
- [x] 2026-03-12 Byla zafixovana pravidla pro `free navigation`, `selection`, `approach` a `Esc return`.
- [x] 2026-03-12 Byly zapsany tvrde gate pro prvni kodovy rez `Blok 1`.

## 2. Proc to vzniklo

Dosavadni spatial iterace ukazaly dve chyby:

1. kamera byla prilis pomala nebo prilis nalepena na hvezdu,
2. vstup do jadra koncil agresivnim zoomem bez orientace.

Proto je pred prvnim kodovym rezem zavazne urceno:

1. jak se operator pohybuje v hlavnim prostoru galaxie,
2. co dela mys, drag, wheel, click a double click,
3. co presne ukazuje radar,
4. co je pro `Blok 1` jeste zakazane.

## 3. Ridici dokumenty

Tento dokument vykonava:

1. `docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md`
2. `docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
3. `docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`
4. `docs/P0-core/contracts/aktivni/fe/fe-be-pravda-a-data-guard-v1CZ.md`

## 4. Pre-implementation kontrakt

### 4.1 Zavazne podminky

1. Hlavni workspace je `prostor galaxie`, ne `star lock view`.
2. Kamera musi pusobit jako pohyb operatora v lodi.
3. Radar je orientacni vrstva, ne admin panel.
4. `selection` a `approach` nesmi rozbit volny pohyb.
5. Hvezda je anchor, ale nesmi veznit kameru.

### 4.2 Co se nepocita jako uspech

1. staticky hero render s jemnym parallax,
2. zoom, ktery skonci "v bile kouli" bez orientace,
3. minimapa jen jako dekorativni bod bez smeru a scope,
4. pseudo-free-camera, ktera realne neumi navigaci mezi objekty.

## 5. Kamera

### 5.1 Vychozi rezim

Vychozi rezim `Bloku 1` je:

1. `free navigation`,
2. jemna inerci pohybu,
3. orientace na zaklade pohledu operatora,
4. bez hard-locku na hvezdu.

### 5.2 Ovládání

1. pohyb mysi:
   - meni smer pohledu,
   - nesmi delat agresivni trhani.
2. drag:
   - dela silnejsi zmenu orientace,
   - musi zachovat pocit prostoru.
3. wheel:
   - meni vzdalenost k aktualnimu zajmovemu poli,
   - nesmi prestat byt citelny horizont a radar.
4. `single click`:
   - vybere objekt,
   - zvyrazni ho v prostoru i radaru.
5. `double click`:
   - spusti `approach`,
   - neprenese uzivatele do interieru objektu bez mezistavu.
6. `Esc`:
   - vraci o jednu vrstvu vys,
   - pri aktivnim `approach` vrati do volneho prostoru.

### 5.3 Approach

`Approach` neni teleport ani crash-zoom.

Musi:

1. byt plynuly,
2. zachovat orientaci na okoli,
3. zastavit v citelne vzdalenosti od objektu,
4. nechat uzivateli stale prostor pro dalsi pohyb.

Zakazano:

1. fullscreen objekt bez periferie,
2. ztrata horizontu nebo mrezove reference,
3. okamzite prepnuti do jine interaction vrstvy bez potvrzeneho dojmu.

### 5.4 Reduced motion

Reduced-motion varianta musi:

1. zkratit prechody,
2. zachovat vyznam `vyber -> approach -> navrat`,
3. nikdy nevypnout orientacni stavove signaly.

## 6. Radar / minimapa

### 6.1 Ucel

Radar slouzi k okamzite orientaci v rostouci galaxii.

Neslouzi jako plnohodnotny editor.

### 6.2 Minimalni obsah pro Blok 1

1. poloha operatora,
2. smer pohledu,
3. hvezda jako dominantni anchor,
4. nejblizsi planety nebo placeholder orbit sloty,
5. aktualne vybrany objekt.

### 6.3 Vizuální pravidla

1. radar musi byt lehky a citelny,
2. ma byt holograficky nebo skleneny,
3. nesmi prebit hlavni sceny,
4. musi byt citelny i pri tmave branch tonalite.

### 6.4 Zakazane stavy

1. tezky pravostranny panel,
2. seznamovy admin layout,
3. radar bez smeru pohledu,
4. radar, ktery nelze svazat s vyberem objektu ve scene.

## 7. Interaction model pro Blok 1

V `Bloku 1` se zavazne implementuje jen:

1. `space_idle`
2. `object_selected`
3. `approach_active`

Zatim se neimplementuje:

1. `Star Core interior`,
2. `Constitution Select`,
3. `grid_open`,
4. `command_draft`,
5. `commit_in_progress`.

## 8. BE truth vazba

Pro `Blok 1` jsou povinne tyto zdroje:

1. `GET /galaxies`
2. `GET /branches`
3. `GET /galaxies/{galaxy_id}/star-core/policy`
4. `GET /galaxies/{galaxy_id}/star-core/physics/profile`
5. `GET /universe/tables`
6. summary feedy pro radar fallback dle `fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md`

Pravidlo:

1. i kdyz `Blok 1` jeste neni planet topology block, radar a selection se musi pripravit tak, aby neodporovaly realnemu layoutu z BE.

## 9. Pripraveny kod z archivu

Pro tento blok jsou pripravene hlavne:

1. `frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx`
2. `frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js`
3. `frontend/src/_inspiration_reset_20260312/components/universe/previewAccessibility.js`

V tomhle bloku se zatim nema vracet:

1. `QuickGridOverlay.jsx`
2. `useCommandBarController.js`
3. `planetBuilderFlow.js`

## 10. Prisny gate pro Blok 1

### 10.1 Technical completion

1. Kamera ma oddeleny state model nebo helper logiku.
2. `selection` a `approach` nejsou zamotane do jednoho monolitu.
3. Radar ma oddeleny render model od scene.

### 10.2 User-visible completion

1. Uzivatel citi volny pohyb v prostoru.
2. Hvezda neni kamera-veznice.
3. Vyber objektu a `approach` jsou citelne na prvni pokus.
4. Radar je realne pouzitelny, ne jen hezky.

### 10.3 Documentation completion

1. Navazny implementacni blok odkazuje na tento dokument.
2. Je explicitne zapsano, ktere archived helpery se skutecne vraci.

### 10.4 Gate completion

1. focused testy pro camera/selection state,
2. focused test pro radar model,
3. screenshot `space idle`,
4. screenshot `object selected`,
5. screenshot `approach active`,
6. explicitni seznam okamzite viditelnych rozdilu.

## 11. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-vykonavaci-dokument-galaxy-space-workspace-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md
sed -n '1,260p' docs/P0-core/contracts/aktivni/fe/fe-be-fe-projekcni-mapa-hlavni-pracovni-prostor-v1CZ.md
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/UniverseCanvas.jsx
sed -n '1,260p' frontend/src/_inspiration_reset_20260312/components/universe/cameraPilotMath.js
```

Vysledek:

- [x] 2026-03-12 Bylo potvrzeno, ze pred prvnim kodovym rezem vznikl samostatny interaction detail pro kameru a radar.
- [x] 2026-03-12 Bylo potvrzeno, ze `Blok 1` ma uzky scope a ze nepredbiha `Star Core interior`, `grid` ani `builder`.

## 12. Co zustava otevrene

- [x] 2026-03-12 Navazny implementacni blok `Blok 1` s konkretnimi aktivnimi runtime soubory byl zapsan.
- [x] 2026-03-12 Kod pro kameru, selection, approach a radar baseline byl otevren a dokonceny.
