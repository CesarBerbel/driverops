# Troubleshooting

- **Porta já em uso:** pare o que estiver usando 5173/8000/5432/8025/1025, ou ajuste as portas no
  `docker-compose.yml`.
- **Mudanças no `docker-compose.yml`/Dockerfiles não refletem:** `make down` seguido de `make up`
  (que já builda com `--build`).
- **Estado do banco bagunçado em desenvolvimento:** `docker compose down -v` remove o volume do
  Postgres (**apaga os dados**), depois `make up` e `make seed-admin` recriam tudo do zero.
- **`make` não encontrado no Windows:** instale via `choco install make`, use Git Bash/WSL, ou use
  os comandos Docker equivalentes em [Rodando sem `make`](makefile.md#rodando-sem-make).

---
Voltar para o [índice da documentação](README.md).
