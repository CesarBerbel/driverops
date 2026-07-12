"""Alerta de contas a receber vencidas."""

from datetime import date, timedelta

import pytest

from apps.alerts.generators import check_receivables_overdue
from apps.alerts.models import NotifType
from apps.customers.models import Customer
from apps.financial.models import Payment
from apps.orders.models import WorkOrder, WorkOrderPart
from apps.vehicles.models import Vehicle

pytestmark = pytest.mark.django_db


def _receivable(due_offset, *, plate, price="150.00", status="ready"):
    customer = Customer.objects.create(name="Cliente")
    vehicle = Vehicle.objects.create(
        customer=customer, license_plate=plate, brand="VW", model="Gol"
    )
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="serviço",
        status=status,
    )
    WorkOrderPart.objects.create(
        order=order, description="Peça", quantity="1", unit_price=price
    )
    if due_offset is not None:
        order.payment_due_date = date.today() + timedelta(days=due_offset)
        order.save(update_fields=["payment_due_date"])
    return order


def test_overdue_receivable_emits_to_financial(super_user):
    _receivable(-5, plate="AAA1A11")  # vencido há 5 dias, saldo 150
    created = check_receivables_overdue()
    assert len(created) == 1
    notif = created[0]
    assert notif.notif_type == NotifType.RECEIVABLES_OVERDUE
    assert notif.recipient_id == super_user.id
    assert notif.data.get("count") == 1
    assert notif.data.get("total") == "150.00"


def test_not_due_does_not_emit(super_user):
    _receivable(15, plate="BBB1B11")  # a vencer
    assert check_receivables_overdue() == []


def test_no_due_date_does_not_emit(super_user):
    _receivable(None, plate="CCC1C11")  # sem vencimento
    assert check_receivables_overdue() == []


def test_paid_overdue_does_not_emit(super_user):
    order = _receivable(-5, plate="DDD1D11")
    Payment.objects.create(
        order=order, amount="150.00", method="pix", paid_at="2026-07-05"
    )  # quitada
    assert check_receivables_overdue() == []
