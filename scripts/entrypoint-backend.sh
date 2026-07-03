#!/usr/bin/env bash
# Docker ENTRYPOINT for the backend container. Waits for the database, runs
# migrations, then hands off to whatever CMD was supplied (runserver in dev,
# gunicorn in prod) -- so `make up` alone always yields a fully migrated app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/wait-for-postgres.sh"

echo "Aplicando migrations..."
python manage.py migrate --noinput

if [ "${DJANGO_ENV:-dev}" = "prod" ]; then
    echo "Coletando arquivos estáticos..."
    python manage.py collectstatic --noinput
fi

exec "$@"
