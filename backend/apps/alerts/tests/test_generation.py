"""Testes de geração: dedup, escopo por permissão e rotinas periódicas."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.alerts.models import (
    Notification,
    NotificationPreference,
    NotificationRule,
    NotifModule,
    NotifPriority,
    NotifType,
)
from apps.alerts.services import emit
from apps.alerts.tests.conftest import make_user

pytestmark = pytest.mark.django_db


def _lead(**over):
    from apps.leads.models import SiteLead

    data = dict(
        name="Maria Costa",
        phone="11991112222",
        vehicle_plate="AAA0B11",
        request_type="diagnostic",
        message="teste",
        consent=True,
    )
    data.update(over)
    return SiteLead.objects.create(**data)


def _order(status, expected_delivery=None):
    from apps.customers.models import Customer
    from apps.orders.models import WorkOrder
    from apps.vehicles.models import Vehicle

    c = Customer.objects.create(name="Cliente OS")
    v = Vehicle.objects.create(
        customer=c, license_plate="OSX1A23", brand="VW", model="Gol"
    )
    return WorkOrder.objects.create(
        customer=c,
        vehicle=v,
        opened_at=date.today() - timedelta(days=10),
        expected_delivery=expected_delivery,
        customer_report="barulho",
        status=status,
    )


# --- emit / dedup / escopo -------------------------------------------------


def test_emit_fans_out_and_dedups(atendente):
    n1 = emit(
        NotifType.SITE_LEAD_CREATED,
        title="Novo pedido",
        message="msg",
        dedup_key="site_lead_created:1",
    )
    assert len(n1) == 1  # só o atendente (único usuário com leads.view + alerts.view)
    n2 = emit(
        NotifType.SITE_LEAD_CREATED,
        title="Novo pedido",
        message="msg",
        dedup_key="site_lead_created:1",
    )
    assert n2 == []
    assert Notification.objects.filter(recipient=atendente).count() == 1


def test_financial_notification_scoped_to_permission(atendente, financeiro):
    created = emit(
        NotifType.PAYMENTS_PENDING,
        title="OS com pagamento pendente",
        message="msg",
        dedup_key="payments_pending:x",
    )
    recipients = {n.recipient_id for n in created}
    assert financeiro.id in recipients  # tem alerts.view_financial
    assert atendente.id not in recipients  # não tem


def test_preference_only_high_priority_filters_info(atendente):
    NotificationPreference.objects.create(user=atendente, only_high_priority=True)
    created = emit(
        NotifType.QUOTE_APPROVED,  # prioridade padrão INFO
        title="Orçamento aprovado",
        message="msg",
        priority=NotifPriority.INFO,
        dedup_key="quote_approved:1",
    )
    assert created == []


def test_disabled_rule_emits_nothing(atendente):
    rule = NotificationRule.get_for(NotifType.SITE_LEAD_CREATED)
    rule.is_enabled = False
    rule.save()
    created = emit(NotifType.SITE_LEAD_CREATED, title="x", message="y", dedup_key="k1")
    assert created == []


# --- geradores -------------------------------------------------------------


def test_lead_created_generator(atendente):
    from apps.alerts.generators import notify_site_lead_created

    lead = _lead()
    created = notify_site_lead_created(lead)
    assert len(created) == 1
    n = created[0]
    assert n.recipient_id == atendente.id
    assert n.url == f"/leads/{lead.id}"
    assert n.module == NotifModule.LEADS


def test_lead_sla_generator(atendente):
    from apps.alerts.generators import check_lead_sla

    old = _lead()
    # força created_at para o passado (auto_now_add não aceita no create).
    from django.utils import timezone

    from apps.leads.models import SiteLead

    SiteLead.objects.filter(pk=old.pk).update(
        created_at=timezone.now() - timedelta(hours=48)
    )
    created = check_lead_sla()
    assert any(n.notif_type == NotifType.SITE_LEAD_SLA for n in created)


def test_os_overdue_generator(atendente):
    from apps.alerts.generators import check_os_overdue
    from apps.orders.models import WorkOrder

    _order(
        WorkOrder.Status.IN_PROGRESS, expected_delivery=date.today() - timedelta(days=2)
    )
    created = check_os_overdue()
    assert len(created) == 1
    assert created[0].notif_type == NotifType.OS_OVERDUE
    assert created[0].recipient_id == atendente.id


def test_os_due_soon_generator(atendente):
    from apps.alerts.generators import check_os_due_soon
    from apps.orders.models import WorkOrder

    _order(WorkOrder.Status.IN_PROGRESS, expected_delivery=date.today())
    created = check_os_due_soon()
    assert len(created) == 1
    assert created[0].notif_type == NotifType.OS_DUE_SOON


def test_os_overdue_grouped(atendente):
    from apps.alerts.generators import check_os_overdue
    from apps.orders.models import WorkOrder

    rule = NotificationRule.get_for(NotifType.OS_OVERDUE)
    rule.group_similar = True
    rule.save()
    _order(WorkOrder.Status.OPEN, expected_delivery=date.today() - timedelta(days=1))
    _order(WorkOrder.Status.OPEN, expected_delivery=date.today() - timedelta(days=3))
    created = check_os_overdue()
    assert len(created) == 1  # um resumo
    assert created[0].data.get("count") == 2


def test_stock_low_generator(atendente):
    from apps.alerts.generators import check_stock_low
    from apps.categories.models import Category
    from apps.parts.models import Part

    cat = Category.objects.create(category_type="part", name="Filtros")
    Part.objects.create(
        category=cat,
        name="Filtro de óleo",
        current_quantity=Decimal("1"),
        min_quantity=Decimal("5"),
    )
    created = check_stock_low()
    # atendente não tem parts.view; ninguém recebe? cria estoquista.
    assert created == []
    make_user("est2@example.com", "estoque")
    created = check_stock_low()
    assert any(n.notif_type == NotifType.STOCK_LOW for n in created)


def test_payments_today_generator(financeiro):
    from apps.alerts.generators import check_payments_today
    from apps.financial.models import Payment
    from apps.orders.models import WorkOrder

    order = _order(WorkOrder.Status.FINISHED)
    Payment.objects.create(
        order=order, amount=Decimal("150.00"), method="pix", paid_at=date.today()
    )
    created = check_payments_today()
    assert len(created) >= 1
    assert created[0].notif_type == NotifType.PAYMENTS_TODAY
    assert created[0].recipient_id == financeiro.id
