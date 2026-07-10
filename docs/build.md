# Build de produção

```bash
make build
```

Gera o bundle estático de produção do frontend (`frontend/dist/`). Os `Dockerfile`s de backend e
frontend também possuem estágios `prod` (gunicorn e nginx, respectivamente) prontos para uso, ainda
que não estejam conectados ao `docker-compose.yml` de desenvolvimento nesta primeira versão.

## Divisão do bundle (*code-splitting*)

As rotas são carregadas sob demanda: `AppRoutes` usa `React.lazy` + `Suspense`, então **cada tela
vira um chunk separado** e o bundle inicial não baixa todas as telas de uma vez (só os *guards* de
rota carregam adiantados). As bibliotecas grandes de terceiros também ficam em chunks próprios via
`build.rollupOptions.output.manualChunks` no [`vite.config.ts`](../frontend/vite.config.ts)
(`react-vendor`, `query-vendor`, `form-vendor`), que têm cache longo por não mudarem a cada alteração
do código da aplicação.

## Dependências fixadas

As dependências Python são **fixadas em versão exata** (`==`) em
[`backend/requirements.txt`](../backend/requirements.txt) e `requirements-dev.txt`, para builds
reprodutíveis e para que o `pip-audit` do CI avalie exatamente o que roda em produção. O frontend já
fixa via `package-lock.json`.

---
Voltar para o [índice da documentação](README.md).
