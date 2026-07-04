from django.db.models import Q
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import WorkOrder
from .serializers import WorkOrderSerializer


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer

    def get_queryset(self):
        queryset = WorkOrder.objects.select_related(
            "customer", "vehicle"
        ).prefetch_related(
            "service_items__service",
            "package_items__package",
            "part_items__part",
        )

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        # Detail routes must resolve an OS regardless of soft-delete/status,
        # same reasoning as the other modules' get_queryset.
        if self.action != "list":
            return queryset

        # Soft-delete dimension (separate from the workflow `status` field).
        active_param = self.request.query_params.get("active", "active")
        if active_param == "active":
            queryset = queryset.filter(is_active=True)
        elif active_param == "inactive":
            queryset = queryset.filter(is_active=False)

        # Workflow status filter (Aberta, Em execução, ...).
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = self.request.query_params.get("search", "").strip()
        if search:
            filters = (
                Q(vehicle__license_plate__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(vehicle__brand__icontains=search)
                | Q(vehicle__model__icontains=search)
            )
            digits = "".join(c for c in search if c.isdigit())
            if digits:
                filters |= Q(customer__whatsapp__icontains=digits) | Q(
                    customer__phone__icontains=digits
                )
            if search.isdigit():
                filters |= Q(number=int(search))
            queryset = queryset.filter(filters)

        return queryset

    def destroy(self, request, *args, **kwargs):
        order = self.get_object()
        order.is_active = False
        order.save(update_fields=["is_active", "updated_at"])
        return Response(status=http_status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        order = self.get_object()
        order.is_active = True
        order.save(update_fields=["is_active", "updated_at"])
        return Response(WorkOrderSerializer(order).data)
