"""Geradores de avisos: por evento (imediato) e por rotina (periódica).

Todos os geradores são **idempotentes** graças à deduplicação por
``dedup_key`` (ver ``services.emit``): rodar a rotina várias vezes no mesmo dia
não gera avisos repetidos. As chaves periódicas incluem a data para que o aviso
"renasça" a cada dia enquanto a pendência existir.
"""

from datetime import timedelta
from decimal import Decimal
from math import ceil

from django.utils import timezone

from .models import NotifType
from .services import emit


def _today():
    return timezone.localdate()


# --- por evento ------------------------------------------------------------


def notify_site_lead_created(lead):
    """Chamado quando um pedido do site é recebido (hook em apps.leads)."""
    veh = (lead.vehicle_plate or "sem veículo").strip()
    return emit(
        NotifType.SITE_LEAD_CREATED,
        title="Novo pedido vindo do site",
        message=f"{lead.name} deixou contato para atendimento ({veh}).",
        detail=(lead.message or "").strip(),
        related_type="SiteLead",
        related_id=lead.id,
        url=f"/leads/{lead.id}",
        action_label="Abrir pedido",
        dedup_key=f"site_lead_created:{lead.id}",
        data={"plate": veh, "phone": lead.phone},
    )


# --- rotinas periódicas ----------------------------------------------------


def check_lead_sla():
    from apps.leads.models import LeadStatus, SiteLead

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.SITE_LEAD_SLA)
    cutoff = timezone.now() - timedelta(hours=rule.lead_time_hours)
    today = _today()
    created = []
    qs = SiteLead.objects.filter(status=LeadStatus.NEW, created_at__lt=cutoff)
    for lead in qs:
        created += emit(
            NotifType.SITE_LEAD_SLA,
            title="Pedido do site aguardando contato",
            message=f"O pedido de {lead.name} está sem contato há mais de {rule.lead_time_hours}h.",
            related_type="SiteLead",
            related_id=lead.id,
            url=f"/leads/{lead.id}",
            action_label="Atender",
            dedup_key=f"site_lead_sla:{lead.id}:{today}",
        )
    return created


def check_os_due_soon():
    from apps.orders.models import WorkOrder
    from apps.orders.status_groups import OPERATIONAL_STATUSES

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.OS_DUE_SOON)
    today = _today()
    window_days = max(1, ceil(rule.lead_time_hours / 24))
    limit = today + timedelta(days=window_days)
    created = []
    qs = WorkOrder.objects.filter(
        status__in=OPERATIONAL_STATUSES,
        expected_delivery__isnull=False,
        expected_delivery__gte=today,
        expected_delivery__lte=limit,
    )
    for order in qs:
        when = order.expected_delivery.strftime("%d/%m/%Y")
        created += emit(
            NotifType.OS_DUE_SOON,
            title=f"OS #{order.number} próxima do vencimento",
            message=f"A OS #{order.number} está prevista para {when}.",
            related_type="WorkOrder",
            related_id=order.id,
            url=f"/orders/{order.id}",
            action_label="Abrir OS",
            dedup_key=f"os_due_soon:{order.id}:{today}",
        )
    return created


def check_os_overdue():
    from apps.orders.models import WorkOrder
    from apps.orders.status_groups import OPERATIONAL_STATUSES

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.OS_OVERDUE)
    today = _today()
    qs = WorkOrder.objects.filter(
        status__in=OPERATIONAL_STATUSES,
        expected_delivery__isnull=False,
        expected_delivery__lt=today,
    )
    if rule.group_similar:
        overdue = list(qs)
        if not overdue:
            return []
        numbers = ", ".join(f"#{o.number}" for o in overdue[:10])
        return emit(
            NotifType.OS_OVERDUE,
            title=f"{len(overdue)} OS atrasada(s)",
            message=f"OS atrasadas: {numbers}." + (" ..." if len(overdue) > 10 else ""),
            url="/kanban",
            action_label="Ver Kanban",
            dedup_key=f"os_overdue:summary:{today}",
            data={"count": len(overdue)},
        )
    created = []
    for order in qs:
        since = order.expected_delivery.strftime("%d/%m/%Y")
        created += emit(
            NotifType.OS_OVERDUE,
            title=f"OS #{order.number} atrasada",
            message=f"A OS #{order.number} está atrasada desde {since}.",
            related_type="WorkOrder",
            related_id=order.id,
            url=f"/orders/{order.id}",
            action_label="Abrir OS",
            dedup_key=f"os_overdue:{order.id}:{today}",
        )
    return created


def check_os_stalled():
    from apps.orders.models import WorkOrder
    from apps.orders.status_groups import OPERATIONAL_STATUSES

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.OS_STALLED)
    today = _today()
    cutoff = timezone.now() - timedelta(days=rule.stall_days)
    created = []
    qs = WorkOrder.objects.filter(status__in=OPERATIONAL_STATUSES).prefetch_related(
        "status_history"
    )
    for order in qs:
        last = order.status_history.first()  # ordenado -created_at
        # Referência = última mudança de status; sem histórico, a criação da OS.
        reference = last.created_at if last else order.created_at
        if reference is None or reference > cutoff:
            continue
        days = (timezone.now() - reference).days
        created += emit(
            NotifType.OS_STALLED,
            title=f"OS #{order.number} parada",
            message=(
                f"A OS #{order.number} está em \"{order.get_status_display()}\" "
                f"há {days} dia(s)."
            ),
            related_type="WorkOrder",
            related_id=order.id,
            url=f"/orders/{order.id}",
            action_label="Abrir OS",
            dedup_key=f"os_stalled:{order.id}:{order.status}:{today}",
        )
    return created


def check_quotes_pending():
    from apps.quotes.models import Quote

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.QUOTE_PENDING)
    today = _today()
    cutoff = timezone.now() - timedelta(days=rule.stall_days)
    created = []
    qs = Quote.objects.filter(
        status__in=[Quote.Status.SENT, Quote.Status.VIEWED],
        sent_at__isnull=False,
        sent_at__lt=cutoff,
    ).select_related("work_order")
    for quote in qs:
        created += emit(
            NotifType.QUOTE_PENDING,
            title=f"Orçamento #{quote.number} aguardando resposta",
            message=(
                f"O orçamento #{quote.number} está sem resposta do cliente há "
                f"mais de {rule.stall_days} dia(s)."
            ),
            related_type="Quote",
            related_id=quote.id,
            url=f"/orders/{quote.work_order_id}",
            action_label="Abrir OS",
            dedup_key=f"quote_pending:{quote.id}:{today}",
        )
    return created


def check_quotes_decided():
    from apps.quotes.models import Quote

    cutoff = timezone.now() - timedelta(days=1)
    created = []
    decided = Quote.objects.filter(
        decided_at__isnull=False, decided_at__gte=cutoff
    ).select_related("work_order")
    for quote in decided:
        if quote.status == Quote.Status.APPROVED:
            created += emit(
                NotifType.QUOTE_APPROVED,
                title=f"Orçamento #{quote.number} aprovado",
                message=f"O cliente aprovou o orçamento #{quote.number}.",
                related_type="Quote",
                related_id=quote.id,
                url=f"/orders/{quote.work_order_id}",
                action_label="Abrir OS",
                dedup_key=f"quote_approved:{quote.id}",
            )
        elif quote.status == Quote.Status.REJECTED:
            created += emit(
                NotifType.QUOTE_REJECTED,
                title=f"Orçamento #{quote.number} recusado",
                message=f"O cliente recusou o orçamento #{quote.number}.",
                related_type="Quote",
                related_id=quote.id,
                url=f"/orders/{quote.work_order_id}",
                action_label="Abrir OS",
                dedup_key=f"quote_rejected:{quote.id}",
            )
    return created


def check_payments_today():
    from apps.financial.models import Payment

    today = _today()
    qs = Payment.objects.filter(paid_at=today)
    count = qs.count()
    if not count:
        return []
    total = sum((p.amount for p in qs), Decimal("0"))
    return emit(
        NotifType.PAYMENTS_TODAY,
        title="Pagamentos registrados hoje",
        message=f"{count} pagamento(s) registrado(s) hoje, somando R$ {total:.2f}.",
        url="/financial",
        action_label="Abrir financeiro",
        dedup_key=f"payments_today:{today}",
        data={"count": count, "total": str(total)},
    )


def _order_final_value(order):
    from apps.orders.models import WorkOrder
    from apps.orders.serializers import line_total

    gross = sum((line_total(i) for i in order.service_items.all()), Decimal("0"))
    gross += sum((line_total(i) for i in order.package_items.all()), Decimal("0"))
    gross += sum((line_total(i) for i in order.part_items.all()), Decimal("0"))
    discount = Decimal("0")
    if order.discount_type == WorkOrder.DiscountType.PERCENT:
        discount = gross * (order.discount_value or Decimal("0")) / Decimal("100")
    elif order.discount_type == WorkOrder.DiscountType.FIXED:
        discount = order.discount_value or Decimal("0")
    final = gross - discount
    return final if final > 0 else Decimal("0")


def check_payments_pending():
    """OS prontas/finalizadas com saldo em aberto (não há vencimento no projeto)."""
    from apps.orders.models import WorkOrder

    today = _today()
    qs = WorkOrder.objects.filter(
        status__in=[WorkOrder.Status.READY, WorkOrder.Status.FINISHED]
    ).prefetch_related("service_items", "package_items", "part_items", "payments")
    pending = []
    for order in qs:
        paid = sum((p.amount for p in order.payments.all()), Decimal("0"))
        if _order_final_value(order) - paid > 0:
            pending.append(order)
    if not pending:
        return []
    numbers = ", ".join(f"#{o.number}" for o in pending[:10])
    return emit(
        NotifType.PAYMENTS_PENDING,
        title=f"{len(pending)} OS com pagamento pendente",
        message=f"OS prontas/finalizadas com saldo em aberto: {numbers}.",
        url="/financial",
        action_label="Abrir financeiro",
        dedup_key=f"payments_pending:{today}",
        data={"count": len(pending)},
    )


def check_stock_low():
    from django.db.models import F

    from apps.parts.models import Part

    from .models import NotificationRule

    rule = NotificationRule.get_for(NotifType.STOCK_LOW)
    today = _today()
    qs = Part.objects.filter(
        min_quantity__isnull=False, current_quantity__lte=F("min_quantity")
    )
    if hasattr(Part, "is_active"):
        qs = qs.filter(is_active=True)
    if rule.group_similar:
        low = list(qs)
        if not low:
            return []
        names = ", ".join(p.name for p in low[:10])
        return emit(
            NotifType.STOCK_LOW,
            title=f"{len(low)} peça(s) abaixo do estoque mínimo",
            message=f"Peças em nível crítico: {names}.",
            url="/parts",
            action_label="Abrir estoque",
            dedup_key=f"stock_low:summary:{today}",
            data={"count": len(low)},
        )
    created = []
    for part in qs:
        created += emit(
            NotifType.STOCK_LOW,
            title=f"Estoque baixo: {part.name}",
            message=(
                f'A peça "{part.name}" está com {part.current_quantity} em estoque '
                f"(mínimo {part.min_quantity})."
            ),
            related_type="Part",
            related_id=part.id,
            url="/parts",
            action_label="Abrir estoque",
            dedup_key=f"stock_low:{part.id}:{today}",
        )
    return created


PERIODIC_CHECKS = [
    check_lead_sla,
    check_os_due_soon,
    check_os_overdue,
    check_os_stalled,
    check_quotes_pending,
    check_quotes_decided,
    check_payments_today,
    check_payments_pending,
    check_stock_low,
]


def run_periodic():
    """Executa todas as rotinas; devolve total de avisos criados."""
    total = 0
    for check in PERIODIC_CHECKS:
        try:
            total += len(check())
        except Exception:  # pragma: no cover - uma rotina não derruba as outras
            import logging

            logging.getLogger("apps.alerts").exception("Falha em %s", check.__name__)
    return total
