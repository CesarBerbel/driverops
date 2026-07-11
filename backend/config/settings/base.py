import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Allows `python manage.py ...` to work outside Docker by picking up the
# repo-root .env file. Inside Docker, env vars are already injected via
# docker-compose's env_file, so this is a harmless no-op there.
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def env_list(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-secret-key-change-me")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "apps.accounts",
    "apps.core",
    "apps.categories",
    "apps.customers",
    "apps.vehicles",
    "apps.parts",
    "apps.suppliers",
    "apps.services",
    "apps.orders",
    "apps.workshop",
    "apps.quotes",
    "apps.financial",
    "apps.notifications",
    "apps.ai_assistant",
    "apps.leads",
    "apps.alerts",
    "apps.checkin",
    "apps.crm",
    "apps.customer_portal",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serve /static/ direto pelo backend (no-op em dev com DEBUG=True).
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.OriginCheckMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "driverops"),
        "USER": os.environ.get("POSTGRES_USER", "driverops"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "driverops"),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded media (e.g. the workshop logo). Served by Django in dev (see
# config/urls.py); a real deployment would front this with the web server / CDN.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Paginação opt-in: só pagina quando o cliente envia ?page (ver
    # apps/core/pagination.py). Sem ?page a listagem volta completa, como hoje.
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.OptionalPageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "password_reset": "3/min",
        # Formulário público de pedidos do site (proteção contra abuso/spam).
        "public_lead": "10/hour",
        # Solicitação de link do portal do cliente (anti-abuso/enumeração de placa).
        "vehicle_portal": "10/hour",
    },
}

# ---------------------------------------------------------------------------
# JWT (delivered via httpOnly cookies -- see apps/accounts/cookies.py)
# ---------------------------------------------------------------------------
ACCESS_TOKEN_LIFETIME_MIN = int(os.environ.get("ACCESS_TOKEN_LIFETIME_MIN", "15"))
REFRESH_TOKEN_LIFETIME_DAYS = int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", "7"))

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_TOKEN_LIFETIME_MIN),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    # Blacklist the previous refresh token on every rotation so that at any
    # moment only the latest refresh token is valid. This is what makes LOGOUT
    # actually end the session: logout blacklists the current (latest) token and,
    # because rotation already invalidated the earlier ones, no stale refresh
    # token survives to mint new access tokens. Tradeoff: if two tabs refresh at
    # the exact same instant, the loser gets a 401 and re-authenticates -- the
    # client's single-flight refresh dedup keeps this rare. Security (revocation
    # on logout) is prioritized over that edge case.
    "BLACKLIST_AFTER_ROTATION": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
# Escopo do cookie de refresh: DEVE cobrir tanto /api/auth/refresh/ quanto
# /api/auth/logout/, senão o navegador não envia o cookie no logout e o token
# nunca é revogado (blacklist). Por isso o path é /api/auth/ (e não só o refresh)
# -- ainda restrito às rotas de auth, sem vazar para o resto da API.
AUTH_COOKIE_REFRESH_PATH = "/api/auth/"
AUTH_COOKIE_SAMESITE = "Lax"
AUTH_COOKIE_SECURE = env_bool("DJANGO_COOKIE_SECURE", False)

# ---------------------------------------------------------------------------
# Email (dev default: Mailpit; see settings/prod.py for real SMTP notes)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "1025"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "DriverOps <no-reply@driverops.local>"
)

# Reset links expire after 1 hour (Django default is 3 days -- too long for a
# password reset flow).
PASSWORD_RESET_TIMEOUT = 60 * 60

# ---------------------------------------------------------------------------
# Logging (console estruturado; nível via LOG_LEVEL, default INFO)
# ---------------------------------------------------------------------------
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        # Erros de request (500) do Django vão para o console com stack trace.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        # Loggers das nossas apps (ex.: apps.alerts, apps.leads).
        "apps": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}
