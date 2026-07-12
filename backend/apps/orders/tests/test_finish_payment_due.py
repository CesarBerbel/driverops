"""Vencimento automático do pagamento ao finalizar a OS."""

from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model

from apps.orders import state_machine
from apps.orders.models import WorkOrder
from apps.workshop.models import OrderSettings

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email="su@example.com", password="StrongPass123", full_name="Root"
    )


def _ready_os(customer, vehicle):
    # Sem itens (valor 0) -> finalizar não esbarra em "exigir pagamento".
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="serviço",
        status="ready",
    )


def test_finish_sets_default_payment_due(customer, vehicle, superuser):
    conf = OrderSettings.get_solo()
    conf.default_payment_due_days = 30
    conf.save()
    order = _ready_os(customer, vehicle)

    state_machine.transition(order.id, "finish", superuser)

    order.refresh_from_db()
    assert order.status == "finished"
    assert order.payment_due_date == date.today() + timedelta(days=30)


def test_finish_does_not_override_manual_due(customer, vehicle, superuser):
    conf = OrderSettings.get_solo()
    conf.default_payment_due_days = 30
    conf.save()
    order = _ready_os(customer, vehicle)
    order.payment_due_date = date(2026, 12, 1)
    order.save(update_fields=["payment_due_date"])

    state_machine.transition(order.id, "finish", superuser)

    order.refresh_from_db()
    assert order.payment_due_date == date(2026, 12, 1)


def test_finish_no_auto_due_when_days_zero(customer, vehicle, superuser):
    conf = OrderSettings.get_solo()
    conf.default_payment_due_days = 0
    conf.save()
    order = _ready_os(customer, vehicle)

    state_machine.transition(order.id, "finish", superuser)

    order.refresh_from_db()
    assert order.payment_due_date is None
