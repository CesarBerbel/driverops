import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = False

# Falha cedo em produção se a chave não for definida (ou for o default de dev).
# Evita subir assinando tokens/sessões com uma chave pública conhecida.
_INSECURE_SECRET = "dev-insecure-secret-key-change-me"
if os.environ.get("DJANGO_SECRET_KEY", "").strip() in ("", _INSECURE_SECRET):
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY precisa ser definido com um valor forte e único em "
        "produção (o default de desenvolvimento não é aceito)."
    )

AUTH_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# WhiteNoise: comprime e versiona os estáticos (admin/DRF) e os serve pelo
# backend, sem exigir um web server para /static/. Mídia (uploads) continua
# servida pelo nginx do docker-compose.prod.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
# HSTS ligado por padrão (1 ano) -- prod pressupõe HTTPS. Ajuste/preload via env.
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", str(60 * 60 * 24 * 365)))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Observabilidade opcional: só ativa se sentry-sdk estiver instalado e o DSN
# for fornecido. Ausência de qualquer um dos dois é um no-op silencioso.
_SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
            send_default_pii=False,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        )
    except ImportError:
        pass
