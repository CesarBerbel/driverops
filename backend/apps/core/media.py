"""Servir mídia (uploads) de forma privada.

Os uploads do sistema (anexos de OS, fotos de check-in, orçamentos assinados)
contêm dados sensíveis e **não** devem ser públicos. Esta view exige
autenticação para servir qualquer arquivo, exceto o logotipo da oficina, que é
branding público.

- Em produção, delega o envio ao nginx via ``X-Accel-Redirect`` (o nginx marca
  a location interna com ``internal;`` -- ninguém acessa ``/media/`` direto).
- Em desenvolvimento (``DEBUG``), transmite o arquivo diretamente.
"""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.accounts.authentication import CookieJWTAuthentication

# Prefixos de mídia públicos (branding). Todo o resto exige autenticação.
PUBLIC_MEDIA_PREFIXES = ("workshop/logos/",)
# Cabeçalho/location interna usada pelo nginx para o envio acelerado em prod.
INTERNAL_MEDIA_LOCATION = "/internal-media/"

# Autorização POR OBJETO: cada prefixo de mídia pertence a um módulo e só é
# servido a quem tem a permissão de leitura desse módulo (não basta estar
# autenticado). Prefixo não mapeado (e não público) é NEGADO por padrão
# (fail-closed) -- salvo superuser.
MEDIA_PERMISSIONS = (
    ("orders/", "orders.view"),
    ("checkin/", "checkin.view"),
    ("quotes/", "quotes.view"),
)


def _required_permission(rel: str) -> str | None:
    for prefix, code in MEDIA_PERMISSIONS:
        if rel.startswith(prefix):
            return code
    return None


class ProtectedMediaView(APIView):
    """Serve ``/media/<path>`` com autenticação (exceto branding público)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [AllowAny]  # a checagem fina é feita aqui embaixo

    def get(self, request, path):
        # Bloqueia path traversal e caminhos absolutos.
        rel = path.replace("\\", "/")
        if rel.startswith("/") or ".." in rel.split("/"):
            raise Http404()

        is_public = rel.startswith(PUBLIC_MEDIA_PREFIXES)
        if not is_public:
            user = request.user
            if not (user and user.is_authenticated):
                raise PermissionDenied(
                    "Autenticação necessária para acessar este arquivo."
                )
            # Autorização por objeto: exige a permissão do módulo dono do arquivo.
            if not user.is_superuser:
                code = _required_permission(rel)
                if code is None or not user.has_perm_code(code):
                    raise PermissionDenied(
                        "Você não tem permissão para acessar este arquivo."
                    )

        if settings.DEBUG:
            full = (Path(settings.MEDIA_ROOT) / rel).resolve()
            root = Path(settings.MEDIA_ROOT).resolve()
            if root not in full.parents and full != root or not full.is_file():
                raise Http404()
            return FileResponse(full.open("rb"))

        # Produção: nginx serve a partir da location interna.
        response = HttpResponse(status=200)
        response["X-Accel-Redirect"] = f"{INTERNAL_MEDIA_LOCATION}{rel}"
        # Deixa o Content-Type a cargo do nginx (remove o default text/html).
        del response["Content-Type"]
        return response
