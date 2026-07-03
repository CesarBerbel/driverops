#!/usr/bin/env bash
# Dedicated, standalone script to create or update the DriverOps superuser.
# Idempotent: safe to run as many times as you like. Credentials come from
# DJANGO_SUPERUSER_EMAIL / DJANGO_SUPERUSER_PASSWORD / DJANGO_SUPERUSER_NAME
# in .env -- see .env.example.
#
# Usage:
#   bash scripts/create-superuser.sh
#
# This is the single source of truth invoked by `make seed-admin` and
# `make createsuperuser`; all it does is delegate to the Django management
# command so there is exactly one place the logic lives.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! docker compose ps --status running --services 2>/dev/null | grep -q '^backend$'; then
    echo "O serviço 'backend' não está rodando. Suba o ambiente primeiro com: make up" >&2
    exit 1
fi

docker compose exec backend python manage.py seed_admin
