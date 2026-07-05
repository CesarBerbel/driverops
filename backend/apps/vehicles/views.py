from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import Vehicle
from .serializers import DUPLICATE_PLATE_MESSAGE, VehicleSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [HasModulePermission]
    permission_module = "vehicles"

    def get_queryset(self):
        queryset = Vehicle.objects.select_related("customer").all()

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        # The active/inactive status filter and free-text search only make
        # sense for the listing -- detail routes (retrieve/update/destroy/
        # reactivate) must be able to find a vehicle regardless of status,
        # same reasoning as CategoryViewSet.get_queryset.
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
                Q(license_plate__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(brand__icontains=search)
                | Q(model__icontains=search)
            )
        return queryset

    def destroy(self, request, *args, **kwargs):
        vehicle = self.get_object()
        vehicle.is_active = False
        vehicle.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        vehicle = self.get_object()
        if Vehicle.has_active_plate_conflict(
            vehicle.license_plate, exclude_pk=vehicle.pk
        ):
            return Response(
                {"license_plate": [DUPLICATE_PLATE_MESSAGE]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        vehicle.is_active = True
        vehicle.save(update_fields=["is_active", "updated_at"])
        return Response(VehicleSerializer(vehicle).data)
