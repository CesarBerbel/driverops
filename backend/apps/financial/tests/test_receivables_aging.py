"""Vencimento + aging das contas a receber."""

from datetime import date, timedelta

import pytest

from apps.financial.aging import bucket_for, days_overdue, is_overdue
from apps.financial.models import Payment
from apps.orders.models import WorkOrder, WorkOrderPart

pytestmark = pytest.mark.django_db

RECEIVABLES = "/api/payments/receivables/"


def _receivable(customer, vehicle, *, due_offset=None, price="100.00"):
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Serviço",
        status="ready",
    )
    WorkOrderPart.objects.create(
        order=order, description="Peça", quantity="1", unit_price=price
    )
    if due_offset is not None:
        order.payment_due_date = date.today() + timedelta(days=due_offset)
        order.save(update_fields=["payment_due_date"])
    return order


# --------------------------------------------------------------------------- #
# aging.py (funções puras)
# --------------------------------------------------------------------------- #
def test_bucket_for():
    today = date(2026, 1, 31)
    assert bucket_for(None, today) == "no_due_date"
    assert bucket_for(date(2026, 2, 10), today) == "not_due"
    assert bucket_for(date(2026, 1, 20), today) == "overdue_1_30"  # 11 dias
    assert bucket_for(date(2025, 12, 15), today) == "overdue_31_60"  # 47 dias
    assert bucket_for(date(2025, 11, 1), today) == "overdue_90_plus"  # 91 dias


def test_days_overdue_and_is_overdue():
    today = date(2026, 1, 31)
    assert days_overdue(date(2026, 1, 20), today) == 11
    assert days_overdue(date(2026, 2, 10), today) == 0  # futuro
    assert days_overdue(None, today) == 0
    assert is_overdue("overdue_1_30") is True
    assert is_overdue("not_due") is False


# --------------------------------------------------------------------------- #
# Serializer da OS
# --------------------------------------------------------------------------- #
def test_os_exposes_aging_when_overdue(auth_client, customer, vehicle):
    order = _receivable(customer, vehicle, due_offset=-40)
    body = auth_client.get(f"/api/work-orders/{order.id}/").json()
    assert body["is_overdue"] is True
    assert body["days_overdue"] == 40
    assert body["aging_bucket"] == "overdue_31_60"
    assert "Vencido" in body["aging_bucket_display"]


def test_os_not_due_and_no_due_date(auth_client, customer, vehicle):
    future = _receivable(customer, vehicle, due_offset=15)
    body = auth_client.get(f"/api/work-orders/{future.id}/").json()
    assert body["is_overdue"] is False
    assert body["aging_bucket"] == "not_due"

    no_due = _receivable(customer, vehicle)
    body2 = auth_client.get(f"/api/work-orders/{no_due.id}/").json()
    assert body2["aging_bucket"] == "no_due_date"
    assert body2["is_overdue"] is False


def test_os_paid_has_no_aging(auth_client, customer, vehicle):
    order = _receivable(customer, vehicle, due_offset=-10)
    Payment.objects.create(
        order=order, amount="100.00", method="pix", paid_at="2026-07-05"
    )
    body = auth_client.get(f"/api/work-orders/{order.id}/").json()
    assert body["balance_due"] == "0.00"
    assert body["aging_bucket"] is None
    assert body["is_overdue"] is False


def test_payment_due_date_is_writable(auth_client, customer, vehicle):
    order = _receivable(customer, vehicle)
    resp = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"payment_due_date": "2026-08-01"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    order.refresh_from_db()
    assert order.payment_due_date == date(2026, 8, 1)


# --------------------------------------------------------------------------- #
# Endpoint de recebíveis
# --------------------------------------------------------------------------- #
def test_receivables_summary_and_totals(auth_client, customer, vehicle):
    _receivable(customer, vehicle, due_offset=-5)  # vencido (1-30)
    _receivable(customer, vehicle, due_offset=15)  # a vencer
    _receivable(customer, vehicle)  # sem vencimento

    body = auth_client.get(RECEIVABLES).json()
    assert body["count"] == 3
    assert body["total_receivable"] == "300.00"
    assert body["total_overdue"] == "100.00"  # só a vencida
    buckets = {row["bucket"]: row for row in body["aging_summary"]}
    assert buckets["overdue_1_30"]["count"] == 1
    assert buckets["overdue_1_30"]["total"] == "100.00"
    assert "not_due" in buckets
    assert "no_due_date" in buckets


def test_receivables_overdue_filter(auth_client, customer, vehicle):
    overdue = _receivable(customer, vehicle, due_offset=-5)
    _receivable(customer, vehicle, due_offset=15)

    body = auth_client.get(RECEIVABLES, {"overdue": "1"}).json()
    assert body["count"] == 1
    assert body["results"][0]["id"] == overdue.id
    # Os totais do topo refletem TODAS as contas (antes do filtro).
    assert body["total_receivable"] == "200.00"


def test_receivables_aging_bucket_filter(auth_client, customer, vehicle):
    _receivable(customer, vehicle, due_offset=-5)
    future = _receivable(customer, vehicle, due_offset=15)

    body = auth_client.get(RECEIVABLES, {"aging": "not_due"}).json()
    assert body["count"] == 1
    assert body["results"][0]["id"] == future.id


def test_receivables_requires_permission(client, customer, vehicle):
    _receivable(customer, vehicle)
    assert client.get(RECEIVABLES).status_code in (401, 403)
