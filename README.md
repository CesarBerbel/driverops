# DriverOps

[![CI](https://github.com/CesarBerbel/driverops/actions/workflows/ci.yml/badge.svg)](https://github.com/CesarBerbel/driverops/actions/workflows/ci.yml)

Sistema web moderno, responsivo e preparado para evolução futura. Esta primeira versão entrega:
página pública, autenticação completa (login, recuperação de senha, logout), dashboard interno,
área de perfil com troca de senha, controle básico de permissões (usuário comum x superusuário) e
todo o ambiente de desenvolvimento containerizado com Docker, automatizado por Makefile.

**Stack:** Django + Django REST Framework (backend) · React + Vite + TypeScript + Tailwind +
shadcn/ui (frontend) · PostgreSQL (banco) · Mailpit (cliente de e-mail de desenvolvimento) · Docker
Compose + Makefile (orquestração).

## Início rápido

```bash
cp .env.example .env
make up
make seed-admin
```

Acesse `http://localhost:5173` e entre com o usuário de desenvolvimento
(`admin@driverops.local` / `ChangeMe123!`). Detalhes em
[Primeiros passos](docs/getting-started.md).

## Documentação

A documentação completa está organizada por assunto em [`docs/`](docs/README.md):

| Documento | Conteúdo |
|---|---|
| [Primeiros passos](docs/getting-started.md) | Pré-requisitos, início rápido, URLs de acesso, credenciais de dev |
| [Variáveis de ambiente](docs/environment-variables.md) | Tabela completa das variáveis usadas pelo `docker-compose.yml` |
| [Banco de dados e migrations](docs/database.md) | Como e quando as migrations rodam |
| [Superusuário](docs/superuser.md) | Criação/atualização idempotente do superusuário de desenvolvimento |
| [Comandos do Makefile](docs/makefile.md) | Todos os alvos do `Makefile` e os comandos Docker equivalentes |
| [Testes e lint](docs/testing.md) | Como rodar e o que cada suíte cobre |
| [Build de produção](docs/build.md) | Geração do bundle de produção do frontend |
| [CI](docs/ci.md) | Como o workflow do GitHub Actions funciona e por que é rápido |
| [Arquitetura e estrutura do projeto](docs/architecture.md) | Organização de pastas do backend e frontend |
| [Segurança (escopo v1)](docs/security.md) | Decisões de segurança tomadas nesta primeira versão |
| [Troubleshooting](docs/troubleshooting.md) | Problemas comuns e como resolvê-los |
