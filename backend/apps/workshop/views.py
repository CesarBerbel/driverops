from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsSuperUser

from .models import OrderSettings, WorkshopProfile
from .serializers import OrderSettingsSerializer, WorkshopProfileSerializer


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
