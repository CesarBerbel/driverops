"""Notificações ao cliente por e-mail sobre o status da OS."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client

from apps.accounts.models import Role
from apps.orders.models import OrderEvent, WorkOrder
from apps.workshop.models import OrderSettings

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def order_with_email(db, customer, vehicle):
    customer.email = "cliente@example.com"
    customer.save(update_fields=["email"])
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        status="testing",
    )


def _move(client, order, status):
    return client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": status},
        content_type="application/json",
    )


def test_auto_email_on_milestone(auth_client, order_with_email):
    _move(auth_client, order_with_email, "ready")
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["cliente@example.com"]
    assert "Pronta para entrega" in mail.outbox[0].subject
    assert OrderEvent.objects.filter(
        order=order_with_email, event_type=OrderEvent.Type.CUSTOMER_NOTIFIED
    ).exists()


def test_no_auto_email_on_non_milestone(auth_client, customer, vehicle):
    customer.email = "cliente@example.com"
    customer.save(update_fields=["email"])
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        status="approved",
    )
    _move(auth_client, order, "in_progress")
    assert len(mail.outbox) == 0


def test_no_auto_email_when_setting_off(auth_client, order_with_email):
    settings = OrderSettings.get_solo()
    settings.notify_customer_by_email = False
    settings.save(update_fields=["notify_customer_by_email"])
    _move(auth_client, order_with_email, "ready")
    assert len(mail.outbox) == 0


def test_no_email_when_customer_has_no_email(auth_client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer,  # sem e-mail
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        status="testing",
    )
    _move(auth_client, order, "ready")
    assert len(mail.outbox) == 0
    assert not OrderEvent.objects.filter(
        order=order, event_type=OrderEvent.Type.CUSTOMER_NOTIFIED
    ).exists()


def test_manual_notify_sends_email(auth_client, order_with_email):
    response = auth_client.post(
        f"/api/work-orders/{order_with_email.id}/notify-customer/"
    )
    assert response.status_code == 200
    assert response.json() == {"sent": True, "email": "cliente@example.com"}
    assert len(mail.outbox) == 1


def test_manual_notify_without_email_returns_400(auth_client, customer, vehicle):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    response = auth_client.post(f"/api/work-orders/{order.id}/notify-customer/")
    assert response.status_code == 400
    assert len(mail.outbox) == 0


def test_auto_email_uses_configured_statuses(auth_client, order_with_email):
    conf = OrderSettings.get_solo()
    conf.notify_statuses = ["in_progress"]  # não inclui "ready"
    conf.save(update_fields=["notify_statuses"])

    order_with_email.status = "approved"
    order_with_email.save(update_fields=["status"])
    _move(auth_client, order_with_email, "in_progress")
    assert len(mail.outbox) == 1
    assert "Em execução" in mail.outbox[0].subject


def test_email_on_creation_when_enabled(auth_client, customer, vehicle):
    conf = OrderSettings.get_solo()
    conf.notify_on_creation = True
    conf.save(update_fields=["notify_on_creation"])
    customer.email = "cliente@example.com"
    customer.save(update_fields=["email"])

    response = auth_client.post(
        "/api/work-orders/",
        data={
            "customer": customer.id,
            "vehicle": vehicle.id,
            "opened_at": "2026-07-04",
            "customer_report": "x",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert len(mail.outbox) == 1
    assert "aberta" in mail.outbox[0].subject
    assert OrderEvent.objects.filter(
        order_id=response.json()["id"],
        event_type=OrderEvent.Type.CUSTOMER_NOTIFIED,
    ).exists()


def test_no_creation_email_by_default(auth_client, customer, vehicle):
    customer.email = "cliente@example.com"
    customer.save(update_fields=["email"])
    auth_client.post(
        "/api/work-orders/",
        data={
            "customer": customer.id,
            "vehicle": vehicle.id,
            "opened_at": "2026-07-04",
            "customer_report": "x",
        },
        content_type="application/json",
    )
    assert len(mail.outbox) == 0  # notify_on_creation é False por padrão


def test_manual_notify_requires_orders_edit(order_with_email):
    # Perfil Estoque: tem orders.view mas não orders.edit.
    stock = User.objects.create_user(
        email="stock@example.com", password="StrongPass123", full_name="Estoquista"
    )
    stock.role = Role.objects.filter(key="estoque").first()
    stock.save(update_fields=["role"])
    client = Client()
    client.post(
        "/api/auth/login/",
        data={"email": stock.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    response = client.post(f"/api/work-orders/{order_with_email.id}/notify-customer/")
    assert response.status_code == 403
