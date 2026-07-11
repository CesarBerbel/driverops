"""Resumo do orçamento da OS na listagem (o orçamento é parte da OS)."""

import pytest

from apps.orders.models import WorkOrder
from apps.quotes.models import Quote

pytestmark = pytest.mark.django_db


def _rows(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) else data


def _order(customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04"
    )


def test_list_exposes_current_quote_status(auth_client, customer, vehicle):
    order = _order(customer, vehicle)

    # Sem orçamento -> quote_status None.
    row = next(
        o for o in _rows(auth_client.get("/api/work-orders/")) if o["id"] == order.id
    )
    assert row["quote_status"] is None
    assert row["quote_status_display"] is None

    Quote.objects.create(work_order=order, status="partially_approved")
    row = next(
        o for o in _rows(auth_client.get("/api/work-orders/")) if o["id"] == order.id
    )
    assert row["quote_status"] == "partially_approved"
    assert row["quote_status_display"] == "Aprovado parcialmente"


def test_current_quote_is_latest_non_canceled(auth_client, customer, vehicle):
    order = _order(customer, vehicle)
    Quote.objects.create(work_order=order, status="rejected")
    Quote.objects.create(work_order=order, status="approved")  # mais recente válido
    Quote.objects.create(work_order=order, status="canceled")  # ignorado

    row = next(
        o for o in _rows(auth_client.get("/api/work-orders/")) if o["id"] == order.id
    )
    assert row["quote_status"] == "approved"
