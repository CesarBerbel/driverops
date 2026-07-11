#!/usr/bin/env bash
# Docker ENTRYPOINT for the backend container. Waits for the database and then
# hands off to CMD (runserver in dev, gunicorn in prod).
#
# Migrations/collectstatic só rodam quando RUN_MIGRATIONS=1 (o padrão, ideal em
# dev e para um único container de app). Com RÉPLICAS em produção, cada réplica
# rodando `migrate` no boot é desperdício e corrida: defina RUN_MIGRATIONS=0 nas
# réplicas e rode um serviço de init dedicado (uma vez) que aplica as migrations.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/wait-for-postgres.sh"

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "Aplicando migrations..."
    python manage.py migrate --noinput
    if [ "${DJANGO_ENV:-dev}" = "prod" ]; then
        echo "Coletando arquivos estáticos..."
        python manage.py collectstatic --noinput
    fi
else
    echo "RUN_MIGRATIONS=0: pulando migrations/collectstatic (feitos pelo serviço de init)."
fi

exec "$@"
