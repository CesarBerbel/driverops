from django.db.models import Q
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
        queryset = Customer.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search))
        return queryset
