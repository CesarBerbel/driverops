# Comandos do Makefile

| Comando | O que faz |
|---|---|
| `make install` | Builda as imagens Docker |
| `make up` | Sobe todo o ambiente (db, mailpit, backend, frontend) com um único comando |
| `make down` | Para e remove os containers |
| `make restart` | `down` + `up` |
| `make logs` | Segue os logs de todos os serviços |
| `make migrate` | Aplica migrations pendentes do Django |
| `make makemigrations` | Gera novas migrations a partir dos models |
| `make seed-admin` | Cria/atualiza o superusuário de desenvolvimento (idempotente) |
| `make createsuperuser` | Alias de `make seed-admin` |
| `make test` | Roda os testes de backend (pytest) e frontend (vitest) |
| `make test-backend` / `make test-frontend` | Roda apenas um dos dois |
| `make lint` | Lint do backend (ruff + black --check) e do frontend (oxlint) |
| `make build` | Builda o bundle de produção do frontend |
| `make shell-backend` / `make shell-frontend` | Abre um shell no container correspondente |
| `make psql` | Abre um `psql` no banco de desenvolvimento |

Veja também: [Superusuário](superuser.md), [Banco de dados e migrations](database.md),
[Testes e lint](testing.md), [Build de produção](build.md).

## Rodando sem `make`

Se `make` não estiver disponível, os comandos Docker equivalentes são:

```bash
docker compose up -d --build                              # make up
docker compose down                                       # make down
docker compose exec backend python manage.py migrate      # make migrate
bash scripts/create-superuser.sh                           # make seed-admin
docker compose exec backend pytest                         # make test-backend
docker compose exec frontend npm run test -- --run         # make test-frontend
docker compose exec backend ruff check . && \
  docker compose exec backend black --check . && \
  docker compose exec frontend npm run lint                # make lint
docker compose exec frontend npm run build                 # make build
```

---
Voltar para o [índice da documentação](README.md).
