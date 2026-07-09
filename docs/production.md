# Implantação em produção

O `docker-compose.yml` da raiz é de **desenvolvimento** (Vite, runserver,
Mailpit). Para produção há um stack separado, `docker-compose.prod.yml`, que
sobe gunicorn, nginx (reverse proxy + SPA + estáticos/mídia), o cron de
notificações e backups do banco.

## Visão geral do stack

| Serviço | Papel |
|---|---|
| `db` | PostgreSQL, **sem porta exposta** ao host, volume `pgdata`. |
| `backend` | Gunicorn (target `prod`); roda migrations e `collectstatic` no boot; escreve estáticos no volume `static` e uploads no `media`. |
| `web` | nginx: serve o SPA (build do frontend) e `/static//media`, e faz proxy de `/api` e `/admin` para o gunicorn. Porta 80 (443 quando o TLS for habilitado). |
| `notifications-cron` | Loop idempotente de `sync_notifications` (ver [Notificações internas](notificacoes-internas.md)). |
| `db-backup` | `pg_dump` periódico (padrão diário) para o volume `backups`, mantendo os 14 mais recentes. |

O SPA é buildado com `VITE_API_URL=/api` (mesma origem), então o navegador
nunca fala direto com o gunicorn — tudo passa pelo nginx.

## Subindo

```bash
cp .env.example .env.prod          # ajuste com valores REAIS
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### `.env.prod` — o que ajustar (mínimo)

- `DJANGO_ENV=prod` — o boot **falha** se `DJANGO_SECRET_KEY` não for definido
  com um valor forte e único (não use o default de dev):
  `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
- `POSTGRES_PASSWORD` forte; `DJANGO_ALLOWED_HOSTS` com o seu domínio.
- `CORS_ALLOWED_ORIGINS` e `FRONTEND_URL` com a URL pública (https).
- E-mail **SMTP real** (`EMAIL_HOST/PORT/USER/PASSWORD`, `EMAIL_USE_TLS=True`) —
  Mailpit é só de desenvolvimento.
- Opcional: `SENTRY_DSN` (captura de erros), `LOG_LEVEL`, `NOTIFICATIONS_SYNC_INTERVAL`,
  `BACKUP_INTERVAL`.

## TLS / HTTPS

O `prod.py` já força cookies `Secure`, `SECURE_SSL_REDIRECT` e **HSTS de 1 ano**,
e confia no header `X-Forwarded-Proto` do proxy. Falta apenas terminar o TLS no
nginx:

1. Coloque `fullchain.pem`/`privkey.pem` em `nginx/certs/` (ex.: via Let's
   Encrypt/Certbot) e descomente o volume de certs no serviço `web`.
2. Descomente o bloco `listen 443 ssl` em [`nginx/prod.conf`](../nginx/prod.conf)
   e a porta `443` no compose; redirecione 80 → 443.

## Backups e restauração

Os dumps ficam no volume `backups` (`driverops-AAAAMMDD-HHMMSS.sql.gz`). Para
restaurar:

```bash
gunzip -c backups/driverops-XXXX.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Recomenda-se **copiar os backups para fora do host** (S3/rsync) — o volume local
não protege contra perda do servidor.

## Estáticos e mídia

- **Estáticos** (admin/DRF) são versionados/comprimidos pelo **WhiteNoise** e
  também servidos pelo nginx a partir do volume `static`.
- **Mídia** (logo da oficina) é servida pelo nginx a partir do volume `media`.

## O que ainda é responsabilidade do operador

- Certificado TLS e domínio.
- Envio dos backups para armazenamento externo.
- Monitoramento/alertas (o Sentry cobre erros de aplicação; infra/uptime é à
  parte).

Volte para o [índice da documentação](README.md).
