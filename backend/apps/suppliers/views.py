from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Supplier
from .serializers import SupplierSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer

    def get_queryset(self):
        queryset = Supplier.objects.all()

        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(trade_name__icontains=search)
                | Q(document__icontains=search)
            )
        return queryset

    def destroy(self, request, *args, **kwargs):
        supplier = self.get_object()
        supplier.is_active = False
        supplier.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        supplier = self.get_object()
        supplier.is_active = True
        supplier.save(update_fields=["is_active", "updated_at"])
        return Response(SupplierSerializer(supplier).data)
