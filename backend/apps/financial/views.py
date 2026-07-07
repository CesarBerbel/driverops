from decimal import Decimal

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.orders.history import record_event
from apps.orders.models import OrderEvent, WorkOrder
from apps.orders.serializers import WorkOrderSerializer

from .models import Payment
from .serializers import PaymentSerializer


def _format_brl(amount: Decimal) -> str:
    return f"R$ {amount}".replace(".", ",")


class PaymentViewSet(viewsets.ModelViewSet):
    """Pagamentos recebidos por OS + relatório de contas a receber.

    Ver pagamentos exige `financial.view`; registrar/estornar exige
    `financial.register_payment`.
    """

    serializer_class = PaymentSerializer
    permission_classes = [HasModulePermission]
    permission_module = "financial"
    http_method_names = ["get", "post", "delete"]
    permission_action_map = {
        "create": "register_payment",
        "destroy": "register_payment",
        "receivables": "view",
    }

    def get_queryset(self):
        queryset = Payment.objects.select_related("order", "created_by")
        order_id = self.request.query_params.get("order")
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset

    def perform_create(self, serializer):
        payment = serializer.save(created_by=self.request.user)
        record_event(
            payment.order,
            OrderEvent.Type.PAYMENT_REGISTERED,
            f"{payment.get_method_display()} · {_format_brl(payment.amount)}",
            actor=self.request.user,
        )

    def perform_destroy(self, instance):
        order = instance.order
        amount = instance.amount
        method_display = instance.get_method_display()
        instance.delete()
        record_event(
            order,
            OrderEvent.Type.PAYMENT_REMOVED,
            f"{method_display} · {_format_brl(amount)}",
            actor=self.request.user,
        )

    @action(detail=False, methods=["get"])
    def receivables(self, request):
        """OS ativas (não canceladas) com saldo devedor > 0 -- contas a receber."""
        queryset = (
            WorkOrder.objects.filter(is_active=True)
            .exclude(status=WorkOrder.Status.CANCELED)
            .select_related("customer", "vehicle", "assigned_technician")
            .prefetch_related(
                "service_items__service",
                "package_items__package",
                "part_items__part",
                "payments",
            )
        )

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = request.query_params.get("search", "").strip()
        if search:
            filters = (
                Q(vehicle__license_plate__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(vehicle__brand__icontains=search)
                | Q(vehicle__model__icontains=search)
            )
            if search.isdigit():
                filters |= Q(number=int(search))
            queryset = queryset.filter(filters)

        serializer = WorkOrderSerializer(
            queryset, many=True, context=self.get_serializer_context()
        )
        # Só as OS com saldo devedor (o valor final/saldo é calculado no serializer).
        rows = [row for row in serializer.data if Decimal(row["balance_due"]) > 0]

        total_receivable = sum(
            (Decimal(row["balance_due"]) for row in rows), Decimal("0")
        )
        return Response(
            {
                "count": len(rows),
                "total_receivable": str(total_receivable),
                "results": rows,
            }
        )
