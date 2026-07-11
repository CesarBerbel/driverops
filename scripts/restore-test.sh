#!/bin/sh
# Teste de RESTAURAÇÃO: pega o dump .sql.gz mais recente, restaura num banco
# TEMPORÁRIO e roda uma verificação de sanidade -- provando que o backup é
# restaurável. Nunca toca no banco de produção (usa um banco descartável).
#
# Uso (no container db-backup, que tem psql/pg_restore):
#   docker compose -f docker-compose.prod.yml exec db-backup sh /app/scripts/restore-test.sh
#
# Env: POSTGRES_* (obrigatórios). Opcional: BACKUPS_DIR (/backups).
set -eu

BACKUPS_DIR="${BACKUPS_DIR:-/backups}"
HOST="${POSTGRES_HOST:-db}"
export PGPASSWORD="$POSTGRES_PASSWORD"

latest="$(ls -1t "$BACKUPS_DIR"/driverops-*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$latest" ]; then
  echo "Nenhum dump encontrado em $BACKUPS_DIR" >&2
  exit 1
fi
echo "Restaurando '$latest' num banco temporário..."

testdb="restore_test_$(date +%s)"
createdb -h "$HOST" -U "$POSTGRES_USER" "$testdb"
# Garante a remoção do banco de teste ao sair (sucesso ou falha).
trap 'dropdb -h "$HOST" -U "$POSTGRES_USER" "$testdb" 2>/dev/null || true' EXIT

gunzip -c "$latest" | psql -h "$HOST" -U "$POSTGRES_USER" -d "$testdb" -v ON_ERROR_STOP=1 >/dev/null

tables="$(psql -h "$HOST" -U "$POSTGRES_USER" -d "$testdb" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
echo "Restauração OK: $tables tabela(s) no banco restaurado."
if [ "$tables" -le 0 ]; then
  echo "FALHA: o banco restaurado não tem tabelas." >&2
  exit 1
fi
