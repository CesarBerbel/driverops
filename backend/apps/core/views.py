from decimal import Decimal

from django.db.models import F
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.orders.serializers import WorkOrderSerializer
from apps.orders.status_groups import (
    IN_PROGRESS_STATUSES,
    OPEN_STATUSES,
    OPERATIONAL_STATUSES,
)
from apps.parts.models import Part
from apps.services.models import Service, ServicePackage
from apps.suppliers.models import Supplier
from apps.vehicles.models import Vehicle

from .periods import period_start_date


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


def _sum_final_value(queryset):
    """Soma o valor final (calculado no serializer) de um conjunto de OS."""
    serializer = WorkOrderSerializer()
    orders = queryset.prefetch_related("service_items", "package_items", "part_items")
    total = sum((Decimal(serializer.get_final_value(o)) for o in orders), Decimal("0"))
    return str(total.quantize(Decimal("0.01")))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Indicadores consolidados para a aba Administrativo do Dashboard.

    O período (``period``) recorta apenas as métricas temporais (OS finalizadas
    e valor finalizado); os totais de cadastro refletem o estado atual.
    """
    period = request.query_params.get("period", "month")
    start = period_start_date(period)

    active_orders = WorkOrder.objects.filter(is_active=True)
    operational = active_orders.filter(status__in=OPERATIONAL_STATUSES)
    finished = active_orders.filter(status="finished")
    if start is not None:
        finished = finished.filter(updated_at__date__gte=start)

    data = {
        "period": period,
        "customers_total": Customer.objects.count(),
        "vehicles_total": Vehicle.objects.filter(is_active=True).count(),
        "suppliers_total": Supplier.objects.filter(is_active=True).count(),
        "parts_total": Part.objects.filter(is_active=True).count(),
        "parts_low_stock": Part.objects.filter(
            is_active=True,
            min_quantity__isnull=False,
            current_quantity__lte=F("min_quantity"),
        ).count(),
        "services_total": Service.objects.filter(is_active=True).count(),
        "packages_total": ServicePackage.objects.filter(is_active=True).count(),
        "os_open": active_orders.filter(status__in=OPEN_STATUSES).count(),
        "os_in_progress": active_orders.filter(status__in=IN_PROGRESS_STATUSES).count(),
        "os_finished_period": finished.count(),
        "os_open_value": _sum_final_value(operational),
        "finished_value_period": _sum_final_value(finished),
    }
    return Response(data)
