from django.http import HttpResponse
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperUser

from .models import (
    LOGO_EXTENSIONS,
    KanbanSettings,
    OrderSettings,
    PdfLayoutSettings,
    WorkshopProfile,
)
from .serializers import (
    KanbanSettingsSerializer,
    OrderSettingsSerializer,
    PdfLayoutSettingsSerializer,
    WorkshopProfileSerializer,
)


class _SoloSettingsView(RetrieveUpdateAPIView):
    """GET para qualquer usuário autenticado; escrita apenas para superusuários.

    Opera sempre sobre o registro único (pk=1) do modelo de configuração.
    """

    model = None

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUser()]
        return [IsAuthenticated()]

    def get_object(self):
        return self.model.get_solo()


class WorkshopProfileView(_SoloSettingsView):
    model = WorkshopProfile
    serializer_class = WorkshopProfileSerializer


class OrderSettingsView(_SoloSettingsView):
    model = OrderSettings
    serializer_class = OrderSettingsSerializer


class KanbanSettingsView(_SoloSettingsView):
    model = KanbanSettings
    serializer_class = KanbanSettingsSerializer


class PdfLayoutSettingsView(_SoloSettingsView):
    model = PdfLayoutSettings
    serializer_class = PdfLayoutSettingsSerializer


class PdfLayoutPreviewView(APIView):
    """Pré-visualização do PDF da OS com o layout enviado (sem salvar).

    Renderiza a OS mais recente usando os blocos/opções do corpo da requisição
    (ou o layout salvo, para os campos omitidos), devolvendo o PDF inline. Assim
    o editor mostra o resultado real das alterações antes de salvar.
    """

    permission_classes = [IsSuperUser]

    def post(self, request):
        from apps.orders.models import WorkOrder
        from apps.orders.pdf import render_order_pdf

        order = (
            WorkOrder.objects.select_related("customer", "vehicle")
            .order_by("-id")
            .first()
        )
        if order is None:
            return Response(
                {"detail": "Crie ao menos uma OS para pré-visualizar o PDF."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PdfLayoutSettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        saved = PdfLayoutSettings.get_solo()
        layout = {
            "blocks": serializer.validated_data.get("blocks", saved.blocks),
            "accent_color": serializer.validated_data.get(
                "accent_color", saved.accent_color
            ),
            "base_font_size": serializer.validated_data.get(
                "base_font_size", saved.base_font_size
            ),
        }
        pdf = render_order_pdf(order, request=request, layout=layout)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="previa-os.pdf"'
        return response


def _looks_like_supported_image(file):
    """Confere a assinatura (magic bytes) do arquivo, não só a extensão.

    Evita que um arquivo com extensão de imagem mas conteúdo arbitrário (ex.:
    SVG/HTML com script, ou um executável renomeado) seja aceito como logo.
    """
    head = file.read(12)
    file.seek(0)
    return (
        head.startswith(b"\x89PNG\r\n\x1a\n")  # PNG
        or head.startswith(b"\xff\xd8\xff")  # JPEG
        or head[:6] in (b"GIF87a", b"GIF89a")  # GIF
        or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")  # WEBP
    )


class WorkshopLogoView(APIView):
    """Upload (POST) / remoção (DELETE) do logotipo da oficina.

    Apenas superusuários. O upload substitui o logo anterior; a remoção apaga o
    arquivo. Ambos devolvem os dados atualizados da oficina.
    """

    permission_classes = [IsSuperUser]
    parser_classes = [MultiPartParser, FormParser]
    MAX_SIZE = 2 * 1024 * 1024  # 2 MB

    def _data(self, profile):
        return WorkshopProfileSerializer(
            profile, context={"request": self.request}
        ).data

    def post(self, request):
        file = request.FILES.get("logo")
        if not file:
            return Response(
                {"logo": ["Envie um arquivo de imagem."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
        if ext not in LOGO_EXTENSIONS:
            return Response(
                {"logo": ["Formato inválido. Use PNG, JPG, WEBP ou GIF."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > self.MAX_SIZE:
            return Response(
                {"logo": ["O arquivo deve ter no máximo 2 MB."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _looks_like_supported_image(file):
            return Response(
                {
                    "logo": [
                        "O arquivo não é uma imagem válida (PNG, JPG, WEBP ou GIF)."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = WorkshopProfile.get_solo()
        if profile.logo:
            profile.logo.delete(save=False)
        profile.logo = file
        profile.save()
        return Response(self._data(profile))

    def delete(self, request):
        profile = WorkshopProfile.get_solo()
        if profile.logo:
            profile.logo.delete(save=False)
            profile.logo = None
            profile.save()
        return Response(self._data(profile))
