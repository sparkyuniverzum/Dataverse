 Celkový stav
  Projekt je teď funkční end-to-end jako „DataVerse atomární vesmír“: backend (FastAPI + PostgreSQL + Alembic), parser a
  task executor v jedné transakci, snapshot pro 3D frontend, frontend ve Vite + React Three Fiber s fyzikálním layoutem
  přes d3-force-3d, command bar a live refresh po execute.

  Základní principy, které jsou dodržené

  - Žádný hard delete v aplikační logice.
  - DB-level ochrana proti hard delete (BEFORE DELETE triggery).
  - Soft-delete všude přes is_deleted + deleted_at.
  - Data model jako graf (atoms, bonds), ne tabulky ve smyslu Excelu.
  - Parser vrací atomické tasky a executor je provádí v jedné DB transakci.

  Kde je co v kódu

  - Manifest/architektura: DataVerse_Master_Plan.md (/mnt/c/Projekty/Dataverse/DataVerse_Master_Plan.md)
  - Backend app: app/main.py (/mnt/c/Projekty/Dataverse/app/main.py)
  - DB připojení: app/db.py (/mnt/c/Projekty/Dataverse/app/db.py)
  - ORM modely: app/models.py (/mnt/c/Projekty/Dataverse/app/models.py)
  - API schémata: app/schemas.py (/mnt/c/Projekty/Dataverse/app/schemas.py)
  - Atom service: app/services/atom_service.py (/mnt/c/Projekty/Dataverse/app/services/atom_service.py)
  - Bond service: app/services/bond_service.py (/mnt/c/Projekty/Dataverse/app/services/bond_service.py)
  - Parser service: app/services/parser_service.py (/mnt/c/Projekty/Dataverse/app/services/parser_service.py)
  - Task executor (jedna transakce): app/services/task_executor_service.py (/mnt/c/Projekty/Dataverse/app/services/
    task_executor_service.py)
  - Universe snapshot service: app/services/universe_service.py (/mnt/c/Projekty/Dataverse/app/services/
    universe_service.py)
  - Alembic config: alembic.ini (/mnt/c/Projekty/Dataverse/alembic.ini)
  - Alembic env: alembic/env.py (/mnt/c/Projekty/Dataverse/alembic/env.py)
  - Initial migrace: alembic/versions/20260227_0001_init_atoms_bonds.py (/mnt/c/Projekty/Dataverse/alembic/
    versions/20260227_0001_init_atoms_bonds.py)
  - Dockerfile: Dockerfile (/mnt/c/Projekty/Dataverse/Dockerfile)
  - Docker compose: docker-compose.yml (/mnt/c/Projekty/Dataverse/docker-compose.yml)
  - Projektové příkazy: Makefile (/mnt/c/Projekty/Dataverse/Makefile)
  - Runbook: README.md (/mnt/c/Projekty/Dataverse/README.md)
  - Frontend app: frontend/src/App.jsx (/mnt/c/Projekty/Dataverse/frontend/src/App.jsx)
  - Frontend package: frontend/package.json (/mnt/c/Projekty/Dataverse/frontend/package.json)
  - Frontend entry: frontend/src/main.jsx (/mnt/c/Projekty/Dataverse/frontend/src/main.jsx)
  - Frontend Vite config: frontend/vite.config.js (/mnt/c/Projekty/Dataverse/frontend/vite.config.js)

  Databáze a migrace

  - Tabulka atoms obsahuje id (UUID), value (JSONB), metadata (JSONB), is_deleted, created_at, deleted_at.
  - Tabulka bonds obsahuje id, source_id, target_id, type, is_deleted, created_at, deleted_at.
  - CHECK constrainty hlídají konzistenci soft-delete.
  - CHECK source_id <> target_id na bonds.
  - Trigger funkce prevent_hard_delete() hází výjimku při DELETE.
  - Triggery trg_atoms_no_delete a trg_bonds_no_delete blokují hard delete.
  - Migrace jsou připravené jako primární způsob správy schématu.

  Backend API endpointy

  - POST /atoms/ingest
  - PATCH /atoms/{atom_id}/extinguish
  - POST /bonds/link
  - PATCH /bonds/{bond_id}/extinguish
  - POST /parser/execute
  - GET /universe/snapshot

  Parser + transakční executor

  - Parser mapuje text na tasky typu INGEST, LINK, SELECT, EXTINGUISH.
  - Podpora:
  - : operátor (např. Pavel Novák : Zaměstnanec)
  - + operátor (např. Pavel + Audi)
  - Triple-shot styl (Ukaž : Pavel @ podmínka)
  - Executor spouští celý seznam tasků v jednom session.begin().
  - Při chybě proběhne rollback.
  - Ověřeno i prakticky na failure scénáři (self-link) s následnou kontrolou, že data nezůstala zapsaná.

  Universe snapshot pro 3D

  - GET /universe/snapshot vrací:
  - atoms: [{ id, value }]
  - bonds: [{ id, source_id, target_id, type }]
  - Vrací jen aktivní data (is_deleted = false).
  - Bonds se navíc filtrují tak, aby oba endpoint atomy byly aktivní.

  Frontend (React Three Fiber)

  - 3D scéna má:
  - černé pozadí #020205
  - Stars
  - OrbitControls
  - neonové koule (Sphere) pro atomy
  - labely přes Billboard + Text
  - neon hrany mezi atomy
  - Bloom přes postprocessing
  - 2D overlay má:
  - status panel vlevo nahoře (počet atomů a bonds)
  - command bar dole uprostřed (EXECUTE)
  - Po submitu:
  - POST /parser/execute
  - potom refresh GET /universe/snapshot
  - input se vyčistí

  Fyzikální layout (vyřešené překryvy)

  - Náhodné fixní pozice byly nahrazené d3-force-3d.
  - Simulace:
  - odpudivost: forceManyBody
  - přitažlivost vazeb: forceLink
  - centering: forceCenter + forceX/Y/Z
  - antikolize: forceCollide
  - Pozice se updatují plynule ve useFrame.
  - Atomy „přilétají“ do stabilního uspořádání.
  - Hrany se renderují dynamicky podle aktuálních pozic uzlů.

  CORS a FE↔BE komunikace

  - Backend má CORS pro:
  - http://127.0.0.1:5173
  - http://localhost:5173
  - FE posílá payload jako { query, text }, takže funguje s tvou FE specifikací i aktuálním backendem.

  Docker / spuštění

  - docker compose up --build rozjede DB, migraci i API.
  - DB běží defaultně na host portu 55432.
  - API na 8000.
  - migrate service dělá alembic upgrade head.
  - Makefile má zkratky pro up, migrate, run-local, migrate-local atd.

  Frontend balíček a install

  - Frontend má kompletní Vite skeleton.
  - Instalace:
  - cd /mnt/c/Projekty/Dataverse/frontend
  - npm install
  - npm run dev
  - Přidaná knihovna pro fyziku: d3-force-3d.

  Co bylo ověřené během implementace

  - Python soubory: py_compile bez chyb.
  - Alembic migrace: proběhly úspěšně.
  - Existence tabulek a triggerů: ověřeno SQL dotazy.
  - Hard delete: ověřeno, že DB vrací chybu HARD DELETE is forbidden....
  - API endpointy: otestované ingest, link, extinguish, parser/execute, universe/snapshot.
  - Frontend build: vite build úspěšný.
  - CORS header: ověřen v response.

  Aktuální provozní obraz

  - Backend i DB běží přes Docker compose.
  - Frontend je připravený a buildovatelný.
  - Snapshot endpoint dodává data pro Three.js.
  - Parser workflow funguje transakčně.
  - Soft-delete zákon je vynucen aplikačně i na DB úrovni.
