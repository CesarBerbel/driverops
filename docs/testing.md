# Testes e lint

## Testes

```bash
make test              # backend + frontend
make test-backend      # apenas pytest (Django)
make test-frontend     # apenas vitest (React)
make coverage          # cobertura (pytest-cov + vitest v8)
```

A suíte de backend cobre login/logout/refresh/proteção de rotas, o fluxo completo de recuperação
de senha (link válido, expirado e inválido), troca de senha, a permissão exclusiva de superusuário
e a idempotência do `seed_admin`. A suíte de frontend cobre o toggle de mostrar/ocultar senha, as
guardas de rota protegida/pública e os fluxos de login e redefinição de senha.

## Lint

```bash
make lint
```

Backend: [ruff](https://docs.astral.sh/ruff/) + `black --check`. Frontend:
[oxlint](https://oxc.rs/docs/guide/usage/linter.html) + `tsc -b` (TypeScript em
modo **strict**).

A configuração de ruff/black fica em [`backend/pyproject.toml`](../backend/pyproject.toml)
(ruff seleciona `E,F,I,UP` e ignora `E501`, que é responsabilidade do black).
Há também hooks opcionais de pré-commit em `.pre-commit-config.yaml` (ative com
`pip install pre-commit && pre-commit install`).

Esses são exatamente os mesmos comandos rodados no [CI](ci.md) a cada push/PR.

---
Voltar para o [índice da documentação](README.md).
