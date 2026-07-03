# Banco de dados e migrations

As migrations do Django rodam **automaticamente** toda vez que o container do backend sobe (veja
`scripts/entrypoint-backend.sh`), então `make up` sozinho já deixa o schema em dia.

Para rodar migrations manualmente (por exemplo, depois de `make makemigrations` sem reiniciar o
container):

```bash
make migrate           # aplica migrations pendentes
make makemigrations    # gera novas migrations a partir de mudanças nos models
```

Para acessar o banco diretamente:

```bash
make psql
```

---
Voltar para o [índice da documentação](README.md).
