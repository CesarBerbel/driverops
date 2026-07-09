from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    # Soft delete (is_active) -- consistente com veículos/peças/etc. Nunca
    # exclui de fato; o registro é preservado por causa das FKs PROTECT.
    serializer_class = CustomerSerializer
    permission_classes = [HasModulePermission]
    permission_module = "customers"

    def get_queryset(self):
        # "vehicles" is the related_name on apps.vehicles.Vehicle.customer --
        # resolved via Django's app registry at query time, so this app
        # never has to import anything from apps.vehicles.
        queryset = Customer.objects.annotate(
            vehicle_count=Count(
                "vehicles", filter=Q(vehicles__is_active=True), distinct=True
            )
        )
        # Rotas de detalhe (retrieve/update/destroy/reactivate) acham o cliente
        # em qualquer status; o filtro por status só vale na listagem.
        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search))
        return queryset

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()
        customer.is_active = False
        customer.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        customer = self.get_object()
        customer.is_active = True
        customer.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(customer).data)
