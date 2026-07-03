# Variáveis de ambiente

Todas as variáveis usadas pelo `docker-compose.yml` estão documentadas em
[`.env.example`](../.env.example). Copie para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

Principais grupos:

| Variável | Descrição |
|---|---|
| `DJANGO_ENV` | `dev` ou `prod` -- seleciona `backend/config/settings/{dev,prod}.py` |
| `DJANGO_SECRET_KEY` | Chave secreta do Django (gere uma nova para produção) |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por vírgula |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT` | Conexão com o banco |
| `CORS_ALLOWED_ORIGINS` | Origem do frontend autorizada a chamar a API com cookies |
| `FRONTEND_URL` | Usada para montar o link de redefinição de senha no e-mail |
| `ACCESS_TOKEN_LIFETIME_MIN` / `REFRESH_TOKEN_LIFETIME_DAYS` | Duração dos tokens JWT |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USE_TLS` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP -- em dev, aponta para o Mailpit |
| `DEFAULT_FROM_EMAIL` | Remetente usado nos e-mails da aplicação |
| `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` / `DJANGO_SUPERUSER_NAME` | Usadas por `make seed-admin` -- ver [Superusuário](superuser.md) |
| `VITE_API_URL` | URL da API que o frontend consome |

Nenhuma credencial fica fixa no código -- tudo é lido de variáveis de ambiente.

---
Voltar para o [índice da documentação](README.md).
