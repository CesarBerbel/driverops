# syntax=docker/dockerfile:1
#
# Build context is the REPO ROOT (see docker-compose.yml: build.context: .),
# so this Dockerfile can pull in both backend/ and the shared scripts/ dir.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt backend/requirements-dev.txt ./

# --------------------------------------------------------------------------
# dev: runserver + dev tooling (pytest, ruff, black); source is bind-mounted
# over this at runtime by docker-compose, so COPY here just makes the image
# runnable standalone too.
# --------------------------------------------------------------------------
FROM base AS dev

RUN pip install -r requirements-dev.txt

COPY backend/ .
COPY scripts/ /app/scripts/

ENTRYPOINT ["bash", "/app/scripts/entrypoint-backend.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# --------------------------------------------------------------------------
# prod: gunicorn, no dev tooling, source baked into the image
# --------------------------------------------------------------------------
FROM base AS prod

RUN pip install -r requirements.txt

COPY backend/ .
COPY scripts/ /app/scripts/

ENV DJANGO_ENV=prod

ENTRYPOINT ["bash", "/app/scripts/entrypoint-backend.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
