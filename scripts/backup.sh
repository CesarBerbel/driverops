#!/bin/sh
# Backup do DriverOps: banco (pg_dump) + mídia (tar). Grava em $BACKUPS_DIR,
# retém os N mais recentes, envia para armazenamento externo S3-compatível se
# configurado e ALERTA (webhook) em caso de falha. Feito para o container
# db-backup (postgres:16-alpine). Idempotente por timestamp.
#
# Env: POSTGRES_* (obrigatórios). Opcionais: BACKUP_RETENTION (14),
#   BACKUP_S3_BUCKET / BACKUP_S3_ENDPOINT (S3 externo, exige aws-cli no container),
#   BACKUP_ALERT_WEBHOOK (Slack/Discord/Mattermost -- POST JSON em falha).
set -u

BACKUPS_DIR="${BACKUPS_DIR:-/backups}"
MEDIA_DIR="${MEDIA_DIR:-/app/media}"
RETENTION="${BACKUP_RETENTION:-14}"
HOST="${POSTGRES_HOST:-db}"
ts="$(date +%Y%m%d-%H%M%S)"

alert() {
  echo "ALERTA: $1" >&2
  if [ -n "${BACKUP_ALERT_WEBHOOK:-}" ]; then
    body="{\"text\":\"[DriverOps backup] $1\",\"content\":\"[DriverOps backup] $1\"}"
    wget -q -O /dev/null --header="Content-Type: application/json" \
      --post-data="$body" "$BACKUP_ALERT_WEBHOOK" \
      || echo "ALERTA: falha ao enviar o webhook" >&2
  fi
}

upload() {  # $1 = caminho do arquivo a enviar ao S3 externo (opcional)
  [ -z "${BACKUP_S3_BUCKET:-}" ] && return 0
  if command -v aws >/dev/null 2>&1; then
    if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
      aws s3 cp "$1" "s3://${BACKUP_S3_BUCKET}/$(basename "$1")" \
        --endpoint-url "$BACKUP_S3_ENDPOINT" || alert "falha ao enviar $(basename "$1") ao S3"
    else
      aws s3 cp "$1" "s3://${BACKUP_S3_BUCKET}/$(basename "$1")" \
        || alert "falha ao enviar $(basename "$1") ao S3"
    fi
  else
    alert "aws-cli ausente: $(basename "$1") não enviado ao S3"
  fi
}

db_file="$BACKUPS_DIR/driverops-$ts.sql.gz"
if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$HOST" -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$db_file"; then
  echo "backup db ok: $(basename "$db_file")"
  upload "$db_file"
else
  rm -f "$db_file"
  alert "pg_dump FALHOU em $ts"
fi

media_file="$BACKUPS_DIR/media-$ts.tar.gz"
if [ -d "$MEDIA_DIR" ] && tar czf "$media_file" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")" 2>/dev/null; then
  echo "backup media ok: $(basename "$media_file")"
  upload "$media_file"
else
  alert "backup de mídia FALHOU em $ts"
fi

# Retenção: mantém os N mais recentes de cada tipo.
ls -1t "$BACKUPS_DIR"/driverops-*.sql.gz 2>/dev/null | tail -n +"$((RETENTION + 1))" | xargs -r rm -f
ls -1t "$BACKUPS_DIR"/media-*.tar.gz 2>/dev/null | tail -n +"$((RETENTION + 1))" | xargs -r rm -f
