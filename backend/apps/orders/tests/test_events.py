"""Linha do tempo unificada da OS (OrderEvent): status, fotos e orçamento."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.orders.models import OrderEvent, WorkOrder

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def media_root(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)


def _create(auth_client, customer, vehicle):
    return auth_client.post(
        "/api/work-orders/",
        data={
            "customer": customer.id,
            "vehicle": vehicle.id,
            "opened_at": "2026-07-04",
            "customer_report": "Barulho",
        },
        content_type="application/json",
    )


def _png():
    return SimpleUploadedFile(
        "foto.png", b"\x89PNG\r\n\x1a\nfake", content_type="image/png"
    )


def test_creating_an_order_records_a_created_event(auth_client, customer, vehicle):
    order_id = _create(auth_client, customer, vehicle).json()["id"]
    events = OrderEvent.objects.filter(order_id=order_id)
    assert events.filter(event_type=OrderEvent.Type.CREATED).count() == 1


def test_move_records_a_status_changed_event(auth_client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    auth_client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": "diagnosing"},
        content_type="application/json",
    )
    event = OrderEvent.objects.filter(
        order=order, event_type=OrderEvent.Type.STATUS_CHANGED
    ).first()
    assert event is not None
    assert "Aberta" in event.description and "Em diagnóstico" in event.description


def test_attachment_add_and_remove_record_events(auth_client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    created = auth_client.post(
        f"/api/work-orders/{order.id}/attachments/", data={"file": _png()}
    ).json()
    assert OrderEvent.objects.filter(
        order=order, event_type=OrderEvent.Type.ATTACHMENT_ADDED
    ).exists()

    auth_client.delete(f"/api/work-orders/{order.id}/attachments/{created['id']}/")
    assert OrderEvent.objects.filter(
        order=order, event_type=OrderEvent.Type.ATTACHMENT_REMOVED
    ).exists()


def test_events_endpoint_lists_and_filters(auth_client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    auth_client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": "diagnosing"},
        content_type="application/json",
    )
    auth_client.post(f"/api/work-orders/{order.id}/attachments/", data={"file": _png()})

    response = auth_client.get(f"/api/work-orders/{order.id}/events/")
    assert response.status_code == 200
    types = {e["event_type"] for e in response.json()}
    assert {"status_changed", "attachment_added"} <= types

    filtered = auth_client.get(
        f"/api/work-orders/{order.id}/events/?type=status_changed"
    )
    assert all(e["event_type"] == "status_changed" for e in filtered.json())


def test_events_require_authentication(client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    assert client.get(f"/api/work-orders/{order.id}/events/").status_code in (401, 403)
