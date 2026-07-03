from django.db.models import Count, Q
from rest_framework import mixins, viewsets

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    # Deliberately no DestroyModelMixin -- deleting customers was never
    # requested (only cadastrar/listar/editar/buscar), so no delete route
    # exists at all.
    serializer_class = CustomerSerializer

    def get_queryset(self):
        # "vehicles" is the related_name on apps.vehicles.Vehicle.customer --
        # resolved via Django's app registry at query time, so this app
        # never has to import anything from apps.vehicles.
        queryset = Customer.objects.annotate(
            vehicle_count=Count(
                "vehicles", filter=Q(vehicles__is_active=True), distinct=True
            )
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search))
        return queryset
