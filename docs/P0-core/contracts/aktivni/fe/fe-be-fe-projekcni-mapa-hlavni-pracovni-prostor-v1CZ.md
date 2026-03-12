# FE BE->FE projekcni mapa hlavni pracovni prostor v1

Stav: aktivni (zavazna projekcni mapa pro Galaxy Space Workspace)
Datum: 2026-03-12
Vlastnik: FE architektura + BE truth governance + Produktove UX

## 1. Co se zmenilo

- [x] 2026-03-12 Byla zavedena konkretni `BE -> FE` projekcni mapa pro hlavni pracovni prostor galaxie.
- [x] 2026-03-12 Byly rozdeleny datove zdroje na `scope`, `space objects`, `governance`, `physics`, `radar`, `telemetry of activity`.
- [x] 2026-03-12 Bylo urceno, co se promita do prostoru, co do HUD, co do minimapy a co zustava az pro pozdejsi vrstvy.

## 2. Proc to vzniklo

Bez projekcni mapy hrozi, ze FE:

1. bude kreslit prostor podle dojmu,
2. pomicha onboarding a workspace,
3. nebude vedet, ktera data patri do objektu, ktera do HUD a ktera do minimapy,
4. bude lhat o stavu galaxie.

Tento dokument je vykonavaci vrstva nad:

1. `fe-master-spec-hlavni-pracovni-prostor-galaxie-v1CZ.md`
2. `fe-be-pravda-a-data-guard-v1CZ.md`

## 3. Zavazny princip

Kazda runtime surface v hlavnim workspace musi mit:

1. `payload source`,
2. `pouzita pole`,
3. `FE projekci`,
4. `fallback / unknown chovani`,
5. `guard helper`.

Bez teto petice se data nesmi promitnout do scene.

## 4. Vrstva A: scope a vstupni pravda

### 4.1 `GET /galaxies`

Ucel:

1. seznam pracovnich prostoru,
2. vyber aktivni galaxie,
3. vstupni `Kontakt 0`.

Klicova pole:

1. `id`
2. `name`
3. `owner_id`
4. `created_at`
5. `deleted_at`

FE projekce:

1. `id` = aktivni scope identita,
2. `name` = jmeno galaxie v HUD a selectoru,
3. `deleted_at` = `vyhasla / archivni` tonalita v selectoru.

Do prostoru galaxie se tato data sami o sobe nepromitaji jako objekty.

### 4.2 `GET /branches`

Ucel:

1. branch scope prepinani,
2. budoucni branch tonalita prostoru.

Klicova pole:

1. `id`
2. `galaxy_id`
3. `name`
4. `base_event_id`
5. `created_at`
6. `deleted_at`

FE projekce:

1. branch jmeno = scope chip,
2. `deleted_at` = zavrena vetev,
3. branch existence = tonalita prostoru a radaru,
4. `main` vs branch = budoucni rozdil v atmosfere.

Guard:

1. `workspaceContract.js`
2. `runtimeNormalizationSignal.js`

## 5. Vrstva B: governance a hvezda

### 5.1 `GET /galaxies/{galaxy_id}/star-core/policy`

Klicova pole:

1. `profile_key`
2. `law_preset`
3. `profile_mode`
4. `no_hard_delete`
5. `deletion_mode`
6. `occ_enforced`
7. `idempotency_supported`
8. `branch_scope_supported`
9. `lock_status`
10. `policy_version`
11. `locked_at`
12. `can_edit_core_laws`

FE projekce:

1. `lock_status` = governance prstenec `UNLOCKED / LOCKED`,
2. `law_preset` = rezim ustavy / ton hvezdy,
3. `profile_mode` = `draft/auto/locked` signal v jadru,
4. `policy_version` = governance metadata, ne dominantni UI,
5. `locked_at` = historicka stopa / timeline metadata,
6. `no_hard_delete` a `deletion_mode` = nedestruktivni vizualni pravidla sveta,
7. `occ_enforced` + `idempotency_supported` = reliability signal v explainability/HUD,
8. `branch_scope_supported` = branch kompatibilita governance.

Fallback:

1. chybejici payload = `stabilizing` nebo `unavailable`,
2. FE nesmi optimisticly kreslit `LOCKED`.

Guard:

1. `starContract.js`
2. `lawResolver.js`
3. `workspaceContractExplainability.js`

### 5.2 `GET /galaxies/{galaxy_id}/star-core/physics/profile`

Klicova pole:

1. `profile_key`
2. `profile_version`
3. `lock_status`
4. `locked_at`
5. `coefficients`

FE projekce:

1. `profile_key` = fyzikalni tonalita galaxie,
2. `profile_version` = upgrade/migration metadata,
3. `coefficients` = vstup pro jemnou derivaci chovani prostoru a planet,
4. `lock_status` = sekundarni potvrzeni governance stavu.

Guard:

1. `planetPhysicsParity.js`
2. `starContract.js`

### 5.3 `GET /galaxies/{galaxy_id}/star-core/runtime`

Klicova pole:

1. `as_of_event_seq`
2. `events_count`
3. `writes_per_minute`

FE projekce:

1. rytmus hvezdy a kosmicke aktivity,
2. signal tempa prostoru,
3. telemetry/HUD signal runtime zateze.

Poznamka:

Toto je `space tempo` vrstva, ne hlavni source of truth pro layout.

### 5.4 `GET /galaxies/{galaxy_id}/star-core/pulse`

Klicova pole:

1. `last_event_seq`
2. `sampled_count`
3. `event_types`
4. `events[].event_type`
5. `events[].entity_id`
6. `events[].visual_hint`
7. `events[].intensity`

FE projekce:

1. impulsy v prostoru,
2. kratke svetelne nebo orbitalni odezvy,
3. lokalni signal, ze v galaxii doslo k udalosti.

Guard:

1. `runtimeDeltaSync.js`
2. `runtimeProjectionPatch.js`

### 5.5 `GET /galaxies/{galaxy_id}/star-core/domain-metrics`

Klicova pole:

1. `domains[].domain_name`
2. `domains[].status`
3. `domains[].events_count`
4. `domains[].activity_intensity`
5. `total_events_count`
6. `updated_at`

FE projekce:

1. sektorove nebo radialni zabarveni prostoru,
2. radar density signal,
3. jemna governance heatmap okolo hvezdy nebo v minimape.

## 6. Vrstva C: prostorove objekty

### 6.1 `GET /universe/tables`

Tohle je hlavni source pro planety jako objekty prostoru.

Klicova pole:

1. `table_id`
2. `galaxy_id`
3. `name`
4. `constellation_name`
5. `planet_name`
6. `archetype`
7. `contract_version`
8. `schema_fields`
9. `formula_fields`
10. `members`
11. `internal_bonds`
12. `external_bonds`
13. `sector.center`
14. `sector.size`
15. `sector.mode`
16. `sector.grid_plate`

FE projekce:

1. planeta jako prostorovy objekt,
2. `constellation_name` = radialni / seskupovaci vrstva,
3. `planet_name` = diegeticky label,
4. `archetype` = typ planety,
5. `members` = hustota / aktivita planety,
6. `schema_fields` + `formula_fields` = komplexita / technicita planety,
7. `internal_bonds` + `external_bonds` = lokalni a meziplanetarni vazby,
8. `sector.center` = pozice planety,
9. `sector.size` = velikost orbitalniho sektoru,
10. `sector.mode` = tvar chovani planety v prostoru,
11. `grid_plate` = ma-li mit lokalni mrezovou pracovni plochu.

Guard:

1. `workspaceContract.js`
2. `runtimeProjectionPatch.js`
3. `projectionConvergenceGate.js`

### 6.2 `GET /universe/snapshot`

Tohle je hlavni source pro detail mesicu/civilization a vazeb.

#### Civilizations

Klicova pole:

1. `id`
2. `value`
3. `table_id`
4. `table_name`
5. `constellation_name`
6. `planet_name`
7. `metadata`
8. `calculated_values`
9. `calc_errors`
10. `error_count`
11. `circular_fields_count`
12. `active_alerts`
13. `physics`
14. `facts`
15. `created_at`
16. `current_event_seq`

FE projekce:

1. mesice / runtime body na planete,
2. kvalita a zdravi objektu,
3. anomaly / warning / hologram signal,
4. detailni inspekce planety,
5. radar hustota a upozorneni.

Poznamka:

`civilization` je runtime row.
V UX vrstvach se muze zobrazovat jako mesic/capability point, ale FE nesmi ztratit vazbu na `civilization` identitu.

#### Bonds

Klicova pole:

1. `id`
2. `source_civilization_id`
3. `target_civilization_id`
4. `type`
5. `physics`
6. `directional`
7. `flow_direction`
8. `source_table_id`
9. `target_table_id`
10. `source_constellation_name`
11. `source_planet_name`
12. `target_constellation_name`
13. `target_planet_name`
14. `current_event_seq`

FE projekce:

1. vazby jako fyzicke linky v prostoru,
2. smerove sipky nebo tok,
3. odliseni internich a meziplanetarnich vazeb,
4. vazebni highlight v minimape.

Guard:

1. `runtimeProjectionPatch.js`
2. `projectionConvergenceGate.js`
3. `workspaceContractExplainability.js`

## 7. Vrstva D: dashboard summary feedy

### 7.1 `GET /galaxies/{galaxy_id}/summary`

Pole:

1. `constellations_count`
2. `planets_count`
3. `moons_count`
4. `bonds_count`
5. `formula_fields_count`
6. `updated_at`

FE projekce:

1. overview HUD,
2. minimapa density scale,
3. onboarding progress reference, pokud je potreba.

### 7.2 `GET /galaxies/{galaxy_id}/health`

Pole:

1. `guardian_rules_count`
2. `alerted_civilizations_count`
3. `circular_fields_count`
4. `quality_score`
5. `status`
6. `updated_at`

FE projekce:

1. stav integrity galaxie,
2. barva reliability HUD,
3. signal, zda prostor pusobi zdrave, varovne nebo anomicky.

### 7.3 `GET /galaxies/{galaxy_id}/activity`

Pole:

1. `event_seq`
2. `event_type`
3. `entity_id`
4. `payload`
5. `happened_at`

FE projekce:

1. feed poslednich impulzu,
2. animovane odezvy v prostoru,
3. timeline strip / radar echoes.

### 7.4 `GET /galaxies/{galaxy_id}/constellations`

Pole:

1. `name`
2. `planets_count`
3. `planet_names`
4. `moons_count`
5. `internal_bonds_count`
6. `external_bonds_count`
7. `quality_score`
8. `status`

FE projekce:

1. sektorove seskupeni prostoru,
2. hustota hvezdne mapy,
3. navigacni vyber souhvezdi.

### 7.5 `GET /galaxies/{galaxy_id}/planets`

Pole:

1. `table_id`
2. `name`
3. `constellation_name`
4. `archetype`
5. `contract_version`
6. `moons_count`
7. `schema_fields_count`
8. `formula_fields_count`
9. `internal_bonds_count`
10. `external_bonds_count`
11. `quality_score`
12. `status`
13. `sector_mode`

FE projekce:

1. minimapa body,
2. overview seznam pro rychlou navigaci,
3. LOD fallback, kdy jeste nechceme tahat plny `universe/tables`.

### 7.6 `GET /galaxies/{galaxy_id}/moons`

Pole:

1. `civilization_id`
2. `label`
3. `table_id`
4. `table_name`
5. `metadata_fields_count`
6. `calculated_fields_count`
7. `active_alerts_count`
8. `quality_score`
9. `status`

FE projekce:

1. signal hustoty planety,
2. capability / runtime complexity,
3. quick radar warnings.

### 7.7 `GET /galaxies/{galaxy_id}/bonds`

Pole:

1. `bond_id`
2. `type`
3. `directional`
4. `flow_direction`
5. `source_*`
6. `target_*`
7. `quality_score`
8. `status`

FE projekce:

1. topologie site,
2. prehled nejdulezitejsich vazeb,
3. minimapa route hints.

## 8. Vrstva E: planetarni fyzika

### 8.1 `GET /galaxies/{galaxy_id}/star-core/planet-physics-runtime`

Pole:

1. `as_of_event_seq`
2. `items[].table_id`
3. `items[].phase`
4. `items[].metrics.activity`
5. `items[].metrics.stress`
6. `items[].metrics.health`
7. `items[].metrics.inactivity`
8. `items[].metrics.corrosion`
9. `items[].metrics.rows`
10. `items[].visual.size_factor`
11. `items[].visual.luminosity`
12. `items[].visual.pulse_rate`
13. `items[].visual.hue`
14. `items[].visual.saturation`
15. `items[].visual.corrosion_level`
16. `items[].visual.crack_intensity`
17. `items[].source_event_seq`
18. `items[].engine_version`

FE projekce:

1. velikost planety,
2. svit planety,
3. rytmus pulzu,
4. barevna tonalita,
5. korozni nebo popraskany signal,
6. zdravi planety,
7. radialni anomalii.

Guard:

1. `planetPhysicsParity.js`
2. `runtimeDeltaSync.js`

## 9. Vrstva F: capability a kontrakt planety

### 9.1 `GET /planets/{planet_id}/capabilities`

Pole:

1. `id`
2. `planet_id`
3. `capability_key`
4. `capability_class`
5. `config`
6. `order_index`
7. `status`
8. `version`

FE projekce:

1. mesice/capability vrstva kolem planety,
2. typ mesice podle `capability_class`,
3. aktivni/deprecated signal capability,
4. order / orbit placement.

### 9.2 `GET /contracts/{table_id}`

Pole:

1. `version`
2. `required_fields`
3. `field_types`
4. `unique_rules`
5. `validators`
6. `auto_semantics`
7. `formula_registry`
8. `physics_rulebook`

FE projekce:

1. inteligentni inspekce planety,
2. schema slozitost,
3. validator gravity / guardian overlay,
4. formule jako specialni energeticka vrstva.

## 10. Vrstva G: command bar jako operation vstup

### 10.1 `POST /parser/plan`

Ucel:

1. deterministicky plan pred commitem,
2. explainability commandu,
3. preview rizik a scope.

Klicova pole:

1. `tasks[]`
2. `parser_version`
3. `fallback_used`
4. `warnings[]`
5. `scope`

FE projekce:

1. `Plan preview` v command baru,
2. seznam atomic tasku pred vykonanim,
3. upozorneni na ambiguity nebo rebinding,
4. potvrzeni, ze command odpovida aktualnimu `selection focus`.

Guard:

1. `commandBarContract.js`
2. `useCommandBarController.js`
3. `workspaceContractExplainability.js`

### 10.2 `POST /parser/execute`

Ucel:

1. prime vykonani parser commandu tam, kde neni potreba mezikrok pres batch bridge.

FE projekce:

1. rychly commit z command baru pro jednoduche flow,
2. auditovatelny command history zaznam.

Poznamka:

Aktivni FE ma preferovat preview-first model. Prime execute nesmi obejit `Plan preview`, pokud command meni realitu.

### 10.3 `POST /tasks/execute-batch`

Ucel:

1. preview a commit parser tasku,
2. bridge mezi parser planem a canonical mutation surfaces.

FE projekce:

1. preview/commit command baru,
2. builder preview pred zapisem,
3. vysvetleni po commitu nebo pri chybe.

Guard:

1. `useCommandBarController.js`
2. `runtimeProjectionPatch.js`
3. `projectionConvergenceGate.js`

## 11. Vrstva H: grid a builder tooling

### 11.1 Grid source set

Grid neni samostatny backend endpoint.

Je slozen z techto truth zdroju:

1. `GET /universe/tables`
2. `GET /universe/snapshot`
3. `GET /contracts/{table_id}`
4. `GET /planets/{planet_id}/capabilities`

FE projekce:

1. vyber planety = otevreni grid scope,
2. vyber `civilization` = presny row editor,
3. kontrakt planety = validator a schema lane,
4. capability feed = modulova vrstva planety.

Guard:

1. `QuickGridOverlay.jsx` jako archivni referencni rozklad odpovednosti,
2. `gridCanvasTruthContract.js`
3. `selectionContextContract.js`
4. `projectionConvergenceGate.js`

### 11.2 Grid mutation surfaces

Canonical mutation surface gridu a builderu:

1. `POST /civilizations`
2. `PATCH /civilizations/{civilization_id}/mutate`
3. `PATCH /civilizations/{civilization_id}/extinguish`
4. `POST /bonds/link`
5. `PATCH /bonds/{bond_id}/mutate`
6. `PATCH /bonds/{bond_id}/extinguish`
7. `POST /planets`
8. `PATCH /planets/{table_id}/extinguish`

FE projekce:

1. grid je canonical editor pro row a bond reality,
2. builder flow nesmi zavest zadnou paralelni mutacni cestu mimo tyto endpointy,
3. command bar muze generovat zamer, ale finalni realita musi sedet s canonical mutation surface.

### 11.3 Builder state orchestration

Archiv poskytuje pouzitelne state modely:

1. `planetBuilderFlow.js`
2. `visualBuilderStateMachine.js`
3. `builderParserCommand.js`

FE projekce:

1. builder system muze mit vice vstupu (`space`, `command bar`, `grid`),
2. ale musi mit jednu stavovou pravdu pro preview, commit a konvergenci,
3. stare `stage-zero` UI se nevraci; vraci se jen stavova disciplina a parser command mapovani.

## 12. Co zustava mimo aktualni workspace vrstvu

Tato mapa zatim nevyzaduje primou projekci:

1. parser aliases a preview surface,
2. batch task execution,
3. import pipeline,
4. detailni preset apply workflow.

Tyto vrstvy se mohou napojit pozdeji jako operation tooling.

## 13. Implementacni priorita projekce

Poradi FE projekce ma byt:

1. scope (`/galaxies`, `/branches`)
2. hvezda (`star-core/policy`, `star-core/physics/profile`)
3. planeta layout (`/universe/tables`)
4. planetarni fyzika (`star-core/planet-physics-runtime`)
5. vazby a runtime detail (`/universe/snapshot`)
6. radar / minimapa summary feedy (`/galaxies/*`)
7. capability vrstva (`/planets/{planet_id}/capabilities`)
8. command bar preview/commit (`/parser/plan`, `/tasks/execute-batch`)
9. grid + builder canonical writes (`/civilizations*`, `/bonds*`, `/planets*`)

## 14. Evidence

Minimalni dukaz:

```bash
cd /mnt/c/Projekty/Dataverse
sed -n '1,240p' app/api/routers/galaxies/core.py
sed -n '1,260p' app/api/routers/branches.py
sed -n '1,240p' app/api/routers/universe.py
sed -n '1,260p' app/api/routers/planets.py
sed -n '1,260p' app/api/routers/capabilities.py
sed -n '1,260p' app/api/routers/parser.py
sed -n '1,260p' app/api/routers/tasks.py
sed -n '1,260p' app/schema_models/star_core.py
sed -n '1,260p' app/schema_models/universe.py
sed -n '1,260p' app/schema_models/dashboard.py
sed -n '1,260p' app/schema_models/moon_capabilities.py
```

Vysledek:

- [x] 2026-03-12 Bylo potvrzeno, ze aktivni BE uz poskytuje vsechny zakladni feedy pro scope, hvezdu, planety, mesice, vazby a branch.
- [x] 2026-03-12 Bylo potvrzeno, ze summary feedy mohou obslouzit minimapu a radar bez nutnosti tahat stale plny detail.
- [x] 2026-03-12 Bylo potvrzeno, ze planet physics runtime uz poskytuje primo vizualni derivace pro planety.
- [x] 2026-03-12 Bylo potvrzeno, ze aktivni BE uz poskytuje parser preview/execute i batch execution pro `command bar` a builder preview.

## 15. Co zustava otevrene

- [x] 2026-03-12 Zavazny vykonavaci dokument `Galaxy Space Workspace v1` byl zapsan.
- [ ] Rozhodnout prvni implementacni rez: kamera + volny pohyb + radar vs. planeta layout.
- [x] 2026-03-12 Aktivni builder system a jeho vazba na `command bar` + `grid` byly zapsany v samostatnem FE dokumentu.
- [ ] U kazdeho dalsiho FE dokumentu pridat sekci `Pripraveny kod z archivu` a explicitne vybrat, ktere helpery se vraci.
