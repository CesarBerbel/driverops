"""Linha do tempo de status da OS: registro automatico em criacao/move."""

import pytest

from apps.orders.models import OrderStatusHistory, WorkOrder

pytestmark = pytest.mark.django_db


def _create_payload(customer, vehicle):
    return {
        "customer": customer.id,
        "vehicle": vehicle.id,
        "opened_at": "2026-07-04",
        "customer_report": "Barulho ao frear",
    }


def _order(customer, vehicle, status="open"):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Barulho",
        status=status,
    )


def _move(client, order, status):
    return client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": status},
        content_type="application/json",
    )


def test_creating_an_order_records_the_initial_status(auth_client, customer, vehicle):
    response = auth_client.post(
        "/api/work-orders/",
        data=_create_payload(customer, vehicle),
        content_type="application/json",
    )
    assert response.status_code == 201
    order_id = response.json()["id"]
    history = OrderStatusHistory.objects.filter(order_id=order_id)
    assert history.count() == 1
    entry = history.first()
    assert entry.from_status == ""  # criação
    assert entry.to_status == "open"
    assert entry.changed_by is not None


def test_move_records_a_history_entry(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    _move(auth_client, order, "diagnosing")
    entry = OrderStatusHistory.objects.filter(order=order).first()
    assert entry.from_status == "open"
    assert entry.to_status == "diagnosing"
    assert entry.changed_by is not None


def test_patch_status_is_rejected_and_does_not_record_history(
    auth_client, customer, vehicle
):
    order = _order(customer, vehicle, status="ready")
    response = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"status": "finished"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "status" in response.json()
    assert OrderStatusHistory.objects.filter(order=order).count() == 0
    order.refresh_from_db()
    assert order.status == "ready"


def test_noop_move_does_not_record(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="in_progress")
    _move(auth_client, order, "in_progress")
    assert OrderStatusHistory.objects.filter(order=order).count() == 0


def test_status_history_endpoint_lists_newest_first(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    _move(auth_client, order, "diagnosing")
    _move(auth_client, order, "awaiting_approval")

    response = auth_client.get(f"/api/work-orders/{order.id}/status-history/")
    assert response.status_code == 200
    rows = response.json()
    assert [r["to_status"] for r in rows] == ["awaiting_approval", "diagnosing"]
    assert rows[0]["to_status_display"] == "Aguardando aprovação"
    assert rows[-1]["from_status_display"] == "Aberta"


def test_status_history_requires_authentication(client, customer, vehicle):
    order = _order(customer, vehicle)
    assert client.get(f"/api/work-orders/{order.id}/status-history/").status_code in (
        401,
        403,
    )
