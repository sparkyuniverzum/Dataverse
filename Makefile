.PHONY: install db-up migrate up up-d api down down-v logs migrate-local run-local test-backend test-frontend test

install:
	./.venv/bin/pip install -r requirements.txt

db-up:
	docker compose up -d db

migrate:
	docker compose run --rm migrate

up:
	docker compose up --build

up-d:
	docker compose up --build -d

api:
	docker compose up --build api

down:
	docker compose down

down-v:
	docker compose down -v

logs:
	docker compose logs -f

migrate-local:
	DATABASE_URL=$${DATABASE_URL:-postgresql+asyncpg://dataverse:dataverse@localhost:55432/dataverse} ./.venv/bin/alembic upgrade head

run-local:
	DATABASE_URL=$${DATABASE_URL:-postgresql+asyncpg://dataverse:dataverse@localhost:55432/dataverse} ./.venv/bin/uvicorn app.main:app --reload

test-backend:
	./.venv/bin/pip install -r requirements-dev.txt
	./.venv/bin/pytest tests -q

test-frontend:
	cd frontend && npm install && npm test

test: test-backend test-frontend
