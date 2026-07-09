"""Defesa anti-CSRF por verificação de Origin/Referer.

Como a autenticação é 100% por cookie (``CookieJWTAuthentication``), o DRF não
aplica a proteção CSRF de sessão. Este middleware adiciona uma camada: em
requisições que alteram estado (POST/PUT/PATCH/DELETE) para ``/api/``, se o
navegador enviar ``Origin`` (ou ``Referer``), ele precisa bater com uma origem
permitida. Requisições sem nenhum dos dois (curl, testes, server-to-server) são
liberadas -- navegadores sempre enviam ``Origin`` em requisições unsafe
cross-site, então o vetor clássico de CSRF continua bloqueado.
"""

from urllib.parse import urlsplit

from django.conf import settings
from django.http import JsonResponse

_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _origin(url):
    if not url:
        return None
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}"


class OriginCheckMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        allowed = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []))
        frontend = _origin(getattr(settings, "FRONTEND_URL", ""))
        if frontend:
            allowed.add(frontend)
        self.allowed = {a.rstrip("/") for a in allowed}

    def __call__(self, request):
        if (
            request.method in _UNSAFE
            and request.path.startswith("/api/")
            and self.allowed
        ):
            origin = request.META.get("HTTP_ORIGIN")
            source = (
                _origin(origin) if origin else _origin(request.META.get("HTTP_REFERER"))
            )
            # Só bloqueia quando há uma origem declarada e ela não é permitida.
            if source is not None and source.rstrip("/") not in self.allowed:
                return JsonResponse(
                    {"detail": "Origem não permitida para esta requisição."},
                    status=403,
                )
        return self.get_response(request)
