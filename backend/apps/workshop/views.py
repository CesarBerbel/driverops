from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperUser

from .models import LOGO_EXTENSIONS, KanbanSettings, OrderSettings, WorkshopProfile
from .serializers import (
    KanbanSettingsSerializer,
    OrderSettingsSerializer,
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
