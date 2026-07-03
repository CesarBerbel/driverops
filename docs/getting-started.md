# Primeiros passos

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose (plugin `docker compose`, v2+)
- `make` (GNU Make). No Windows, use Git Bash (que já traz `bash` para os scripts) e instale o
  `make` via `choco install make`, ou rode os comandos Docker equivalentes listados em
  [Comandos do Makefile](makefile.md#rodando-sem-make)

Não é necessário instalar Python, Node ou Postgres localmente -- tudo roda em containers.

## Início rápido

```bash
cp .env.example .env
make up
make seed-admin
```

Isso sobe banco, Mailpit, backend e frontend, aplica as migrations automaticamente e cria o
superusuário de desenvolvimento. Acesse `http://localhost:5173` e entre com as
[credenciais de desenvolvimento](#credenciais-de-desenvolvimento-somente-local).

## Acessando a aplicação

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API (backend) | http://localhost:8000/api/ |
| Django admin | http://localhost:8000/admin/ |
| Mailpit (e-mails de dev) | http://localhost:8025 |
| PostgreSQL | `localhost:5432` (ver credenciais em `.env`) |

Todo e-mail enviado pela aplicação em desenvolvimento (ex.: recuperação de senha) é capturado pelo
Mailpit -- nada é enviado para caixas de e-mail reais. Abra `http://localhost:8025` para visualizá-los.

## Credenciais de desenvolvimento (somente local)

> ⚠️ Válidas apenas para o ambiente local criado a partir de `.env.example`. Nunca use estes
> valores em produção.

| Campo | Valor |
|---|---|
| E-mail | `admin@driverops.local` |
| Senha | `ChangeMe123!` |

Essas credenciais vêm de `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` no seu `.env` e são
aplicadas ao rodar `make seed-admin` -- veja [Superusuário](superuser.md) para detalhes.

---
Voltar para o [índice da documentação](README.md).
