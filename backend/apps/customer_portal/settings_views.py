"""Endpoint INTERNO (autenticado) de configuração do Portal do Cliente."""

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import require_permission

from .models import CustomerPortalSettings
from .serializers import CustomerPortalSettingsSerializer


class CustomerPortalSettingsView(APIView):
    """GET/PATCH da configuração do Portal do Cliente (registro único)."""

    def get_permissions(self):
        code = "settings.edit" if self.request.method == "PATCH" else "settings.view"
        return [require_permission(code)()]

    def get(self, request):
        conf = CustomerPortalSettings.get_solo()
        return Response(CustomerPortalSettingsSerializer(conf).data)

    def patch(self, request):
        conf = CustomerPortalSettings.get_solo()
        serializer = CustomerPortalSettingsSerializer(
            conf, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(
            request, "customer_portal.settings.update", new_value=serializer.data
        )
        return Response(serializer.data)
