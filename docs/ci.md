# CI

O workflow em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda no GitHub Actions a
cada push em `main` e a cada pull request, e foi desenhado para ser rápido:

- **Path filtering** (`dorny/paths-filter`): o job de backend só roda se algo em `backend/` (ou
  `scripts/`) mudou; o de frontend só roda se algo em `frontend/` mudou. Uma PR que mexe só no
  frontend não paga o custo de subir Postgres e rodar pytest, e vice-versa.
- **Cache de dependências**: `actions/setup-python` e `actions/setup-node` cacheiam `pip` e `npm`
  por hash do lockfile, então instalações repetidas em commits seguidos são quase instantâneas.
- **Cancelamento de execuções obsoletas**: um novo push no mesmo branch/PR cancela a execução
  anterior em andamento (`concurrency` + `cancel-in-progress`), evitando gastar minutos de CI em
  commits já superados.
- **Job de backend**: sobe um Postgres como *service container*, roda `pip-audit` (auditoria de
  vulnerabilidades nas dependências fixadas em `requirements.txt`, `--strict`), `ruff check`,
  `black --check`, `manage.py migrate` e `pytest`.
- **Job de frontend**: `oxlint`, `tsc -b` (typecheck), `vitest` e `vite build`.
- **Job `ci`** (*fail-closed*): um único status obrigatório que agrega o resultado dos jobs acima. Ele
  só passa se **cada** job dependente terminou em `success` ou `skipped` (pulo legítimo do
  path-filter); qualquer outro resultado -- `failure`, `cancelled` ou vazio -- **reprova** o gate.
  Assim um job que quebrou ou foi cancelado nunca é confundido com "passou", e o *branch protection*
  precisa observar só este status.

Os comandos rodados são os mesmos documentados em [Testes e lint](testing.md) e
[Build de produção](build.md), então o que passa localmente com `make lint`/`make test`/`make build`
passa no CI.

---
Voltar para o [índice da documentação](README.md).
