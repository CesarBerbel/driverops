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
| `web` | nginx: serve o SPA (build do frontend) e `/static`, faz proxy de `/api`, `/admin` e `/media` para o gunicorn (mídia é **privada**, ver abaixo). Termina TLS na porta 443 e redireciona 80 → 443. |
| `notifications-cron` | Loop idempotente de `sync_notifications` + `sync_crm` (ver [Notificações internas](notificacoes-internas.md)). |
| `db-backup` | `pg_dump` **e** tar da mídia, periódicos (padrão diário), para o volume `backups`, mantendo os 14 mais recentes de cada tipo. |

Os serviços `db`, `backend` e `web` têm **healthchecks**: o `backend` só é
considerado saudável quando `/api/health/` responde, e o `web`/`notifications-cron`
dependem desse estado (`condition: service_healthy`), evitando servir tráfego
antes do backend estar pronto.

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

O `db-backup` grava, no volume `backups`, tanto o dump do banco
(`driverops-AAAAMMDD-HHMMSS.sql.gz`) quanto um tar da mídia
(`media-AAAAMMDD-HHMMSS.tar.gz`). Para restaurar o banco:

```bash
gunzip -c backups/driverops-XXXX.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Para restaurar a mídia, extraia o tar correspondente sobre o volume `media`.
Recomenda-se **copiar os backups para fora do host** (S3/rsync) — o volume local
não protege contra perda do servidor.

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
