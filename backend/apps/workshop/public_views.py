"""Endpoint público (sem autenticação) para a landing page institucional.

Expõe apenas dados **seguros e públicos**: os dados institucionais da oficina
(Configurações → Dados da Oficina) e a lista de serviços ativos. Campos
sensíveis nunca são retornados. Fallback seguro: quando um dado não está
configurado, volta vazio/omisso e o frontend oculta a seção correspondente.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.services.models import Service

from .models import WorkshopProfile


def _address_line(p):
    parts = []
    if p.street:
        parts.append(f"{p.street}, {p.number}".strip().rstrip(","))
    for attr in ("neighborhood", "city"):
        value = getattr(p, attr, "")
        if value:
            parts.append(value)
    if p.state:
        parts.append(p.state)
    return " - ".join(x for x in parts if x)


class PublicLandingView(APIView):
    """Dados públicos da oficina para a página institucional."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        p = WorkshopProfile.get_solo()
        logo_url = ""
        if getattr(p, "logo", None):
            try:
                logo_url = request.build_absolute_uri(p.logo.url)
            except ValueError:
                logo_url = ""

        services = (
            Service.objects.filter(is_active=True)
            .order_by("name")
            .values("name", "description")[:24]
        )

        return Response(
            {
                "workshop": {
                    "trade_name": p.trade_name,
                    "legal_name": p.legal_name,
                    "cnpj": p.cnpj,
                    "email": p.email,
                    "phone": p.phone,
                    "whatsapp": p.whatsapp,
                    "website": p.website,
                    "business_hours": p.business_hours,
                    "logo": logo_url,
                    "address_line": _address_line(p),
                    "city": p.city,
                    "state": p.state,
                    "zip_code": p.zip_code,
                },
                "services": [
                    {"name": s["name"], "description": s["description"]}
                    for s in services
                ],
                # Depoimentos configurados pela oficina (vazio => landing usa exemplos).
                "testimonials": (
                    p.testimonials if isinstance(p.testimonials, list) else []
                ),
            }
        )
