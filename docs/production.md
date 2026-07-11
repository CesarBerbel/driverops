# Implantação em produção

O `docker-compose.yml` da raiz é de **desenvolvimento** (Vite, runserver,
Mailpit). Para produção há um stack separado, `docker-compose.prod.yml`, que
sobe gunicorn, nginx (reverse proxy + SPA + estáticos/mídia), o cron de
notificações e backups do banco.

## Visão geral do stack

| Serviço | Papel |
|---|---|
| `db` | PostgreSQL, **sem porta exposta** ao host, volume `pgdata`. |
| `backend-migrate` | Init **one-shot**: aplica migrations e `collectstatic` uma vez e sai. Separa a migração do boot das réplicas de app. |
| `backend` | Gunicorn (target `prod`); sobe com `RUN_MIGRATIONS=0` (não migra — o `backend-migrate` já fez) e depende dele concluir. Escreve estáticos no volume `static` e uploads no `media`. |
| `web` | nginx: serve o SPA (build do frontend) e `/static`, faz proxy de `/api`, `/admin` e `/media` para o gunicorn (mídia é **privada**, ver abaixo). Termina TLS na porta 443 e redireciona 80 → 443. |
| `notifications-cron` | Loop idempotente de `sync_notifications` + `sync_crm` (ver [Notificações internas](notificacoes-internas.md)), com **log por ciclo** e **heartbeat** para o healthcheck. |
| `db-backup` | Roda `scripts/backup.sh` periodicamente (padrão diário): `pg_dump` **e** tar da mídia para o volume `backups`, com retenção, **alerta em falha** e envio opcional a **S3 externo**. |

Os serviços `db`, `backend`, `web`, `notifications-cron` e `db-backup` têm
**healthchecks**: o `backend` só é saudável quando `/api/health/` responde; o
`web` depende disso; o `notifications-cron` e o `db-backup` reprovam o healthcheck
se o ciclo/backup parar (heartbeat / dump recente). O boot da migração é feito
**uma vez** pelo `backend-migrate` -- assim escalar `backend` (réplicas) não faz N
containers rodarem `migrate` em paralelo. Para um app single-instance, dá para
manter `RUN_MIGRATIONS=1` no `backend` e dispensar o init.

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
e confia no header `X-Forwarded-Proto` do proxy. O [`nginx/prod.conf`](../nginx/prod.conf)
**já vem com TLS habilitado por padrão**: a porta 80 só atende o desafio ACME
(Let's Encrypt) e redireciona todo o resto para 443; a 443 usa `ssl_protocols
TLSv1.2 TLSv1.3` e envia HSTS + cabeçalhos de segurança. Para subir:

1. Coloque `fullchain.pem`/`privkey.pem` em `nginx/certs/` (ex.: via Let's
   Encrypt/Certbot). O volume de certs já está montado no serviço `web`.
2. `up -d` — as portas 80 e 443 já estão publicadas no compose.

**Ainda sem certificado?** Use o fallback HTTP-only trocando o volume do nginx
por [`nginx/prod.http-only.conf`](../nginx/prod.http-only.conf) (mantém a mídia
privada, mas sem TLS) — apenas para *bootstrap*, não para exposição pública.

## Backups e restauração

O `db-backup` roda [`scripts/backup.sh`](../scripts/backup.sh) periodicamente
(`BACKUP_INTERVAL`, padrão diário) e grava no volume `backups` o dump do banco
(`driverops-AAAAMMDD-HHMMSS.sql.gz`) e um tar da mídia
(`media-AAAAMMDD-HHMMSS.tar.gz`), mantendo os `BACKUP_RETENTION` (14) mais
recentes de cada tipo.

- **Alerta em falha:** defina `BACKUP_ALERT_WEBHOOK` (URL de Slack/Discord/
  Mattermost) e uma falha de dump/mídia/envio dispara um POST JSON de aviso.
- **Armazenamento externo (recomendado):** defina `BACKUP_S3_BUCKET` (e
  opcionalmente `BACKUP_S3_ENDPOINT` para S3-compatível como MinIO/Backblaze) e
  cada arquivo é enviado ao bucket via `aws s3 cp` (o `aws-cli` é instalado sob
  demanda no container). Sem isso o backup fica só no volume local, que **não**
  protege contra perda do servidor.
- **Healthcheck:** o serviço reprova se não houver um dump recente.

Restaurar o banco:

```bash
gunzip -c backups/driverops-XXXX.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Para restaurar a mídia, extraia o tar correspondente sobre o volume `media`.

**Teste de restauração (faça periodicamente):** um backup só vale se restaura.
[`scripts/restore-test.sh`](../scripts/restore-test.sh) restaura o dump mais
recente num banco **temporário** e valida (conta tabelas), sem tocar em produção:

```bash
docker compose -f docker-compose.prod.yml exec db-backup sh /app/scripts/restore-test.sh
```

## Estáticos e mídia

- **Estáticos** (admin/DRF) são versionados/comprimidos pelo **WhiteNoise** e
  também servidos pelo nginx a partir do volume `static`.
- **Mídia** (uploads) é **privada**: o nginx faz proxy de `/media/` para o
  backend, que autentica a requisição e delega a entrega via `X-Accel-Redirect`
  para a *location* interna `/internal-media/`. Só o *branding* público (logo da
  oficina) dispensa autenticação. Ver [Segurança](security.md).

## O que ainda é responsabilidade do operador

- Certificado TLS e domínio.
- Envio dos backups para armazenamento externo.
- Monitoramento/alertas (o Sentry cobre erros de aplicação; infra/uptime é à
  parte).

Volte para o [índice da documentação](README.md).
