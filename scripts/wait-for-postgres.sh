#!/usr/bin/env bash
# Polls Postgres until it accepts connections. Used by entrypoint-backend.sh
# so `migrate` never races the db container's startup.
set -euo pipefail

HOST="${POSTGRES_HOST:-db}"
PORT="${POSTGRES_PORT:-5432}"
MAX_ATTEMPTS=60

echo "Aguardando Postgres em ${HOST}:${PORT}..."

attempt=0
until python -c "
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(('${HOST}', ${PORT}))
except OSError:
    sys.exit(1)
" ; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "Postgres não respondeu após ${MAX_ATTEMPTS} tentativas. Abortando." >&2
        exit 1
    fi
    sleep 1
done

echo "Postgres disponível."
