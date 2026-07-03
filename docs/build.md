# Build de produção

```bash
make build
```

Gera o bundle estático de produção do frontend (`frontend/dist/`). Os `Dockerfile`s de backend e
frontend também possuem estágios `prod` (gunicorn e nginx, respectivamente) prontos para uso, ainda
que não estejam conectados ao `docker-compose.yml` de desenvolvimento nesta primeira versão.

---
Voltar para o [índice da documentação](README.md).
