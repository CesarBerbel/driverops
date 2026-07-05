from django.db.models import Q
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.core.periods import period_start_date

from .models import WorkOrder
from .serializers import WorkOrderSerializer
from .status_groups import OPERATIONAL_STATUSES
from .status_transitions import can_transition


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [HasModulePermission]
    permission_module = "orders"
    # Arrastar/mudar status é uma edição da OS.
    permission_action_map = {"move": "edit"}

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

        # Operational board (Dashboard aba OS): only OS still in the shop flow,
        # never finished/canceled.
        if self.request.query_params.get("board") == "operational":
            queryset = queryset.filter(status__in=OPERATIONAL_STATUSES)

        # Period filter over the opening date (Hoje/Esta semana/Este mês/30 dias).
        start = period_start_date(self.request.query_params.get("period"))
        if start is not None:
            queryset = queryset.filter(opened_at__gte=start)

        # Workflow status filter (Aberta, Em execução, ...). Accepts a single
        # status or a comma-separated list (used by the Kanban to fetch only the
        # visible columns in one request).
        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [s for s in status_param.split(",") if s]
            queryset = queryset.filter(status__in=statuses)

        # Overdue filter (OS atrasadas): expected delivery in the past and still
        # in the shop flow (never finished/canceled).
        if self.request.query_params.get("overdue") in ("true", "1"):
            queryset = queryset.filter(
                expected_delivery__lt=timezone.localdate()
            ).exclude(status__in=[WorkOrder.Status.FINISHED, WorkOrder.Status.CANCELED])

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

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Muda o status da OS respeitando o fluxo do Kanban.

        Chamada quando um card é arrastado para outra coluna. O backend valida a
        transição (fonte da verdade); transições inválidas retornam 400 com
        mensagem clara e o frontend faz rollback do card para a coluna anterior.
        """
        order = self.get_object()
        new_status = request.data.get("status")
        labels = dict(WorkOrder.Status.choices)
        if new_status not in labels:
            return Response(
                {"status": ["Status inválido."]},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if not can_transition(order.status, new_status):
            return Response(
                {
                    "status": [
                        f"Não é possível mover de '{order.get_status_display()}' "
                        f"para '{labels[new_status]}'."
                    ]
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if new_status != order.status:
            order.status = new_status
            order.save(update_fields=["status", "updated_at"])
        serializer = WorkOrderSerializer(order, context=self.get_serializer_context())
        return Response(serializer.data)
