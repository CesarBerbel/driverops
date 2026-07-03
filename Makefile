.DEFAULT_GOAL := help
.PHONY: help install up down restart logs migrate makemigrations seed-admin createsuperuser \
        test test-backend test-frontend lint build shell-backend shell-frontend psql

## Show available targets
help:
	@echo "DriverOps -- comandos disponiveis:"
	@echo "  make install          Builda as imagens Docker (baixa dependencias)"
	@echo "  make up               Sobe todo o ambiente (db, mailpit, backend, frontend)"
	@echo "  make down             Para e remove os containers"
	@echo "  make restart          down + up"
	@echo "  make logs             Segue os logs de todos os servicos"
	@echo "  make migrate          Roda as migrations do Django"
	@echo "  make makemigrations   Gera novas migrations a partir dos models"
	@echo "  make seed-admin       Cria/atualiza o superusuario (idempotente)"
	@echo "  make createsuperuser  Alias de 'make seed-admin'"
	@echo "  make test             Roda os testes de backend e frontend"
	@echo "  make lint             Roda lint de backend e frontend"
	@echo "  make build            Builda o frontend para producao"
	@echo "  make shell-backend    Abre um shell no container do backend"
	@echo "  make shell-frontend   Abre um shell no container do frontend"
	@echo "  make psql             Abre um psql no container do banco"

## Build all Docker images
install:
	docker compose build

## Bring the whole stack up (db, mailpit, backend, frontend)
up:
	docker compose up -d --build
	@echo ""
	@echo "Ambiente no ar:"
	@echo "  Frontend:      http://localhost:5173"
	@echo "  Backend API:   http://localhost:8000/api/"
	@echo "  Django admin:  http://localhost:8000/admin/"
	@echo "  Mailpit:       http://localhost:8025"
	@echo ""
	@echo "Rode 'make seed-admin' para criar o superusuario de desenvolvimento."

## Stop and remove containers
down:
	docker compose down

## Restart the whole stack
restart: down up

## Follow logs from every service
logs:
	docker compose logs -f

## Apply pending Django migrations
migrate:
	docker compose exec backend python manage.py migrate

## Generate new Django migrations from model changes
makemigrations:
	docker compose exec backend python manage.py makemigrations

## Create or update the dev superuser (idempotent) -- delegates to scripts/create-superuser.sh
seed-admin:
	bash scripts/create-superuser.sh

## Alias for seed-admin
createsuperuser: seed-admin

## Run backend (pytest) and frontend (vitest) test suites
test: test-backend test-frontend

## Run backend tests only
test-backend:
	docker compose exec backend pytest

## Run frontend tests only
test-frontend:
	docker compose exec frontend npm run test -- --run

## Lint backend (ruff + black --check) and frontend (eslint)
lint:
	docker compose exec backend ruff check .
	docker compose exec backend black --check .
	docker compose exec frontend npm run lint

## Build the frontend production bundle
build:
	docker compose exec frontend npm run build

## Open a shell inside the backend container
shell-backend:
	docker compose exec backend bash

## Open a shell inside the frontend container
shell-frontend:
	docker compose exec frontend sh

## Open a psql session against the dev database
psql:
	docker compose exec db psql -U $${POSTGRES_USER:-driverops} -d $${POSTGRES_DB:-driverops}
