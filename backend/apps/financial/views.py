from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission
from apps.core.periods import period_start_date
from apps.orders.history import record_event
from apps.orders.models import OrderEvent, WorkOrder
from apps.orders.notifications import maybe_notify_payment
from apps.orders.serializers import WorkOrderSerializer

from .models import Expense, Payment
from .serializers import ExpenseSerializer, PaymentSerializer

CENTS = Decimal("0.01")


def _money(value) -> str:
    return str((value or Decimal("0")).quantize(CENTS))


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
        "report": "reports",
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
        # Recibo por e-mail ao cliente (se configurado).
        maybe_notify_payment(payment.order, payment, actor=self.request.user)

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

    @action(detail=False, methods=["get"])
    def report(self, request):
        """Relatório de recebimentos no período (por data de pagamento).

        Exige `financial.reports`. Totais, ticket médio, quebra por forma de
        pagamento e série diária -- base dos gráficos do frontend.
        """
        start = period_start_date(request.query_params.get("period"))
        today = timezone.localdate()

        payments = Payment.objects.all()
        if start is not None:
            payments = payments.filter(paid_at__gte=start, paid_at__lte=today)

        agg = payments.aggregate(
            total=Sum("amount"),
            count=Count("id"),
            orders=Count("order", distinct=True),
        )
        total = agg["total"] or Decimal("0")
        count = agg["count"] or 0
        orders = agg["orders"] or 0
        average_ticket = (total / orders) if orders else Decimal("0")

        labels = dict(Payment.Method.choices)
        by_method = [
            {
                "method": row["method"],
                "method_display": labels.get(row["method"], row["method"]),
                "total": _money(row["total"]),
                "count": row["count"],
            }
            for row in payments.values("method")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        ]

        totals_by_date = {
            row["paid_at"]: row["total"] or Decimal("0")
            for row in payments.values("paid_at").annotate(total=Sum("amount"))
        }
        by_day = []
        if start is not None:
            # Preenche todo o intervalo [start, hoje] (dias sem pagamento = 0).
            day = start
            while day <= today:
                by_day.append(
                    {"date": day.isoformat(), "total": _money(totals_by_date.get(day))}
                )
                day += timedelta(days=1)
        else:
            for date_key in sorted(totals_by_date):
                by_day.append(
                    {
                        "date": date_key.isoformat(),
                        "total": _money(totals_by_date[date_key]),
                    }
                )

        return Response(
            {
                "total_received": _money(total),
                "payment_count": count,
                "orders_count": orders,
                "average_ticket": _money(average_ticket),
                "by_method": by_method,
                "by_day": by_day,
            }
        )


class ExpenseViewSet(viewsets.ModelViewSet):
    """Despesas da oficina (saídas) + resultado do período (DRE).

    Ver exige `financial.view`; criar/editar/excluir exige
    `financial.register_expense`; o resumo DRE exige `financial.reports`.
    """

    serializer_class = ExpenseSerializer
    permission_classes = [HasModulePermission]
    permission_module = "financial"
    permission_action_map = {
        "create": "register_expense",
        "update": "register_expense",
        "partial_update": "register_expense",
        "destroy": "register_expense",
        "dre": "reports",
    }

    def get_queryset(self):
        queryset = Expense.objects.select_related("created_by")
        if self.action != "list":
            return queryset

        start = period_start_date(self.request.query_params.get("period"))
        if start is not None:
            queryset = queryset.filter(
                incurred_at__gte=start, incurred_at__lte=timezone.localdate()
            )
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(description__icontains=search) | Q(note__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def dre(self, request):
        """Resultado do período (DRE): receitas − despesas + despesas por categoria."""
        start = period_start_date(request.query_params.get("period"))
        today = timezone.localdate()

        payments = Payment.objects.all()
        expenses = Expense.objects.all()
        if start is not None:
            payments = payments.filter(paid_at__gte=start, paid_at__lte=today)
            expenses = expenses.filter(incurred_at__gte=start, incurred_at__lte=today)

        total_revenue = payments.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        total_expenses = expenses.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        result = total_revenue - total_expenses

        labels = dict(Expense.Category.choices)
        by_category = [
            {
                "category": row["category"],
                "category_display": labels.get(row["category"], row["category"]),
                "total": _money(row["total"]),
                "count": row["count"],
            }
            for row in expenses.values("category")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        ]

        return Response(
            {
                "total_revenue": _money(total_revenue),
                "total_expenses": _money(total_expenses),
                "result": _money(result),
                "expenses_by_category": by_category,
            }
        )
