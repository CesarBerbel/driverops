"""Cliente 360°: agregações consolidadas do relacionamento com um cliente.

Reutiliza os dados existentes (veículos, OS, orçamentos, pagamentos, CRM) e
respeita permissões (financeiro exige ``financial.view``). Carregamento sob
demanda: a visão geral vem enxuta; as abas têm endpoints próprios paginados.
"""

from decimal import Decimal

from django.utils import timezone
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.audit import record_audit
from apps.accounts.permissions import require_permission
from apps.core.money import apply_discount, money
from apps.orders.serializers import line_total
from apps.quotes.calc import compute_totals

from .c360_serializers import InteractionSerializer
from .models import Customer

OPERATIONAL = [
    "open",
    "diagnosing",
    "awaiting_approval",
    "approved",
    "in_progress",
    "awaiting_parts",
    "testing",
    "ready",
]


# --- helpers ---------------------------------------------------------------


def _order_final(order):
    gross = sum((line_total(i) for i in order.service_items.all()), Decimal("0"))
    gross += sum((line_total(i) for i in order.package_items.all()), Decimal("0"))
    gross += sum((line_total(i) for i in order.part_items.all()), Decimal("0"))
    discount = apply_discount(gross, order.discount_type, order.discount_value)
    return money(gross - discount)


def _order_paid(order):
    return money(sum((p.amount for p in order.payments.all()), Decimal("0")))


def _order_balance(order):
    bal = _order_final(order) - _order_paid(order)
    return bal if bal > 0 else Decimal("0")


def _orders(customer):
    return (
        customer.work_orders.filter(is_active=True)
        .select_related("vehicle")
        .prefetch_related("service_items", "package_items", "part_items", "payments")
    )


def _quotes(customer):
    from apps.quotes.models import Quote

    return (
        Quote.objects.filter(work_order__customer=customer)
        .select_related("work_order", "work_order__vehicle")
        .prefetch_related("items")
    )


def _order_row(order):
    return {
        "id": order.id,
        "number": order.number,
        "status": order.status,
        "status_display": order.get_status_display(),
        "opened_at": order.opened_at,
        "expected_delivery": order.expected_delivery,
        "vehicle_plate": order.vehicle.license_plate if order.vehicle else "",
        "customer_report": order.customer_report[:160],
        "final_value": str(_order_final(order)),
        "balance_due": str(_order_balance(order)),
        "is_overdue": bool(
            order.expected_delivery
            and order.status in OPERATIONAL
            and order.expected_delivery < timezone.localdate()
        ),
    }


def _quote_row(q):
    return {
        "id": q.id,
        "number": q.number,
        "version": q.version,
        "status": q.status,
        "status_display": q.get_status_display(),
        "work_order": q.work_order_id,
        "work_order_number": q.work_order.number if q.work_order else None,
        "vehicle_plate": (
            q.work_order.vehicle.license_plate
            if q.work_order and q.work_order.vehicle
            else ""
        ),
        "sent_at": q.sent_at,
        "decided_at": q.decided_at,
        "valid_until": q.valid_until,
        "created_at": q.created_at,
        "public_token": q.public_token,
        "final_value": str(compute_totals(q).get("final_value", "0")),
    }


def _address_line(c):
    parts = [c.street, c.number, c.neighborhood]
    line = ", ".join(p for p in parts if p)
    if c.city:
        line = f"{line} — {c.city}" if line else c.city
        if c.state:
            line = f"{line}/{c.state}"
    return line


def _financial_summary(customer):
    orders = list(_orders(customer))
    total = sum((_order_final(o) for o in orders), Decimal("0"))
    paid = sum((_order_paid(o) for o in orders), Decimal("0"))
    open_value = sum((_order_balance(o) for o in orders), Decimal("0"))
    from apps.financial.models import Payment

    payments = (
        Payment.objects.filter(order__customer=customer)
        .select_related("order")
        .order_by("-paid_at", "-id")[:20]
    )
    return {
        "total_value": str(money(total)),
        "paid_value": str(money(paid)),
        "open_value": str(money(open_value)),
        "orders_with_balance": sum(1 for o in orders if _order_balance(o) > 0),
        "payments": [
            {
                "id": p.id,
                "order_number": p.order.number if p.order else None,
                "amount": str(p.amount),
                "method": p.get_method_display(),
                "paid_at": p.paid_at,
            }
            for p in payments
        ],
    }


# --- views -----------------------------------------------------------------


class _CustomerScopedView(APIView):
    """Base: exige customers.view e resolve o cliente."""

    def get_permissions(self):
        return [require_permission("customers.view")()]

    def customer(self, pk):
        return get_object_or_404(Customer, pk=pk)


class Customer360View(_CustomerScopedView):
    def get(self, request, pk):
        c = self.customer(pk)
        orders = list(_orders(c))

        quotes = list(_quotes(c))
        open_orders = [o for o in orders if o.status in OPERATIONAL]
        finished = [o for o in orders if o.status == "finished"]
        pending_quotes = [q for q in quotes if q.status in ("sent", "viewed")]
        approved_quotes = [
            q for q in quotes if q.status in ("approved", "partially_approved")
        ]
        open_value = sum((_order_balance(o) for o in orders), Decimal("0"))
        vehicles = list(c.vehicles.filter(is_active=True))
        interactions = list(c.interactions.all()[:5])
        can_financial = request.user.has_perm_code("financial.view")

        last_finished = max(finished, key=lambda o: o.opened_at, default=None)
        last_interaction = c.interactions.first()

        # Sugestões abertas do CRM (se o módulo/permite).
        crm_count = 0
        if request.user.has_perm_code("crm.view"):
            from apps.crm.models import OPEN_STATUSES, CrmSuggestion

            crm_count = CrmSuggestion.objects.filter(
                customer=c, status__in=OPEN_STATUSES
            ).count()

        alerts = self._alerts(
            c, open_orders, pending_quotes, open_value, can_financial, crm_count
        )

        record_audit(request, "customer.view_360", new_value={"customer": c.id})

        return Response(
            {
                "customer": {
                    "id": c.id,
                    "name": c.name,
                    "customer_type": c.customer_type,
                    "customer_type_display": c.get_customer_type_display(),
                    "email": c.email,
                    "phone": c.phone,
                    "whatsapp": c.whatsapp,
                    "document": c.document,
                    "address_line": _address_line(c),
                    "city": c.city,
                    "state": c.state,
                    "notes": c.notes,
                    "is_active": c.is_active,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                },
                "summary": {
                    "vehicles": len(vehicles),
                    "open_os": len(open_orders),
                    "finished_os": len(finished),
                    "pending_quotes": len(pending_quotes),
                    "approved_quotes": len(approved_quotes),
                    "total_value": (
                        str(money(sum((_order_final(o) for o in orders), Decimal("0"))))
                        if can_financial
                        else None
                    ),
                    "open_value": str(money(open_value)) if can_financial else None,
                    "last_visit": last_finished.opened_at if last_finished else None,
                    "last_interaction": (
                        last_interaction.created_at if last_interaction else None
                    ),
                    "pending_count": len(open_orders) + len(pending_quotes),
                },
                "alerts": alerts,
                "vehicles": [
                    {
                        "id": v.id,
                        "license_plate": v.license_plate,
                        "brand": v.brand,
                        "model": v.model,
                        "model_year": v.model_year,
                    }
                    for v in vehicles
                ],
                "open_orders": [_order_row(o) for o in open_orders],
                "last_finished_order": (
                    _order_row(last_finished) if last_finished else None
                ),
                "pending_quotes": [_quote_row(q) for q in pending_quotes],
                "recent_interactions": InteractionSerializer(
                    interactions, many=True
                ).data,
                "crm_count": crm_count,
                "can_financial": can_financial,
                "can_interactions": request.user.has_perm_code(
                    "customers.interactions"
                ),
            }
        )

    def _alerts(
        self, c, open_orders, pending_quotes, open_value, can_financial, crm_count
    ):
        alerts = []
        if not c.is_active:
            alerts.append(
                {
                    "type": "inactive",
                    "severity": "warning",
                    "message": "Cliente inativo.",
                    "link": "",
                }
            )
        if open_orders:
            alerts.append(
                {
                    "type": "open_os",
                    "severity": "info",
                    "message": f"{len(open_orders)} OS em aberto.",
                    "link": "",
                }
            )
        if any(o.status == "ready" for o in open_orders):
            alerts.append(
                {
                    "type": "ready",
                    "severity": "info",
                    "message": "Há veículo pronto para retirada.",
                    "link": "",
                }
            )
        if any(_order_row(o)["is_overdue"] for o in open_orders):
            alerts.append(
                {
                    "type": "overdue",
                    "severity": "danger",
                    "message": "Há OS atrasada.",
                    "link": "",
                }
            )
        if pending_quotes:
            alerts.append(
                {
                    "type": "quote_pending",
                    "severity": "info",
                    "message": f"{len(pending_quotes)} orçamento(s) aguardando resposta.",
                    "link": "",
                }
            )
        if can_financial and open_value > 0:
            alerts.append(
                {
                    "type": "open_value",
                    "severity": "warning",
                    "message": "Cliente com valor em aberto.",
                    "link": "",
                }
            )
        if not c.phone and not c.email:
            alerts.append(
                {
                    "type": "incomplete",
                    "severity": "warning",
                    "message": "Dados cadastrais incompletos (sem telefone/e-mail).",
                    "link": "",
                }
            )
        if crm_count:
            alerts.append(
                {
                    "type": "crm",
                    "severity": "info",
                    "message": f"{crm_count} próxima(s) ação(ões) recomendada(s).",
                    "link": "/crm",
                }
            )
        return alerts


class Customer360OrdersView(_CustomerScopedView):
    def get(self, request, pk):
        c = self.customer(pk)
        qs = _orders(c)
        p = request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("vehicle"):
            qs = qs.filter(vehicle_id=p["vehicle"])
        rows = sorted(qs, key=lambda o: (o.status not in OPERATIONAL, -o.number))
        return Response([_order_row(o) for o in rows])


class Customer360QuotesView(_CustomerScopedView):
    def get(self, request, pk):
        c = self.customer(pk)
        qs = _quotes(c)
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return Response([_quote_row(q) for q in qs.order_by("-number")])


class Customer360FinancialView(APIView):
    def get_permissions(self):
        return [require_permission("financial.view")()]

    def get(self, request, pk):
        c = get_object_or_404(Customer, pk=pk)
        return Response(_financial_summary(c))


class CustomerInteractionsView(APIView):
    def get_permissions(self):
        return [require_permission("customers.interactions")()]

    def get(self, request, pk):
        c = get_object_or_404(Customer, pk=pk)
        qs = c.interactions.select_related(
            "created_by", "vehicle", "work_order", "quote"
        )
        if request.query_params.get("type"):
            qs = qs.filter(interaction_type=request.query_params["type"])
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        return Response(InteractionSerializer(qs, many=True).data)

    def post(self, request, pk):
        c = get_object_or_404(Customer, pk=pk)
        serializer = InteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction = serializer.save(
            customer=c,
            created_by=request.user if request.user.is_authenticated else None,
        )
        record_audit(
            request,
            "customer.interaction.create",
            new_value={"customer": c.id, "interaction": interaction.id},
        )
        return Response(InteractionSerializer(interaction).data, status=201)


class Customer360TimelineView(_CustomerScopedView):
    def get(self, request, pk):
        c = self.customer(pk)
        events = []
        events.append(
            {"date": c.created_at, "type": "customer", "title": "Cliente cadastrado."}
        )
        for v in c.vehicles.all():
            events.append(
                {
                    "date": v.created_at,
                    "type": "vehicle",
                    "title": f"Veículo {v.license_plate} adicionado.",
                }
            )
        for o in _orders(c):
            events.append(
                {
                    "date": o.created_at,
                    "type": "order",
                    "title": f"OS #{o.number} criada.",
                    "link": f"/orders/{o.id}",
                }
            )
            hist = (
                o.status_history.filter(to_status="finished")
                .order_by("-created_at")
                .first()
            )
            if hist:
                events.append(
                    {
                        "date": hist.created_at,
                        "type": "order_finished",
                        "title": f"OS #{o.number} finalizada.",
                        "link": f"/orders/{o.id}",
                    }
                )
        for q in _quotes(c):
            if q.sent_at:
                events.append(
                    {
                        "date": q.sent_at,
                        "type": "quote_sent",
                        "title": f"Orçamento #{q.number} enviado.",
                    }
                )
            if q.decided_at:
                label = (
                    "aprovado"
                    if q.status in ("approved", "partially_approved")
                    else "recusado"
                )
                events.append(
                    {
                        "date": q.decided_at,
                        "type": "quote_decided",
                        "title": f"Orçamento #{q.number} {label}.",
                    }
                )
        if request.user.has_perm_code("financial.view"):
            from apps.financial.models import Payment

            for pmt in Payment.objects.filter(order__customer=c).select_related(
                "order"
            ):
                import datetime

                events.append(
                    {
                        "date": datetime.datetime.combine(
                            pmt.paid_at,
                            datetime.time(12),
                            tzinfo=timezone.get_current_timezone(),
                        ),
                        "type": "payment",
                        "title": f"Pagamento de R$ {pmt.amount} (OS #{pmt.order.number if pmt.order else '-'}).",
                    }
                )
        if request.user.has_perm_code("customers.interactions"):
            for i in c.interactions.all():
                events.append(
                    {
                        "date": i.created_at,
                        "type": "interaction",
                        "title": f"{i.get_interaction_type_display()}: {i.summary}",
                    }
                )

        etype = request.query_params.get("type")
        if etype:
            events = [e for e in events if e["type"] == etype]
        events.sort(key=lambda e: e["date"], reverse=True)
        return Response(events[:80])
