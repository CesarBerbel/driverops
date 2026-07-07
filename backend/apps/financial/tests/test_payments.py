"""Pagamentos da OS: registro, status financeiro, recebíveis e permissões."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.accounts.models import Permission, UserPermission
from apps.orders.models import OrderEvent, WorkOrder

pytestmark = pytest.mark.django_db

User = get_user_model()


def _pay(client, order, amount, method="pix"):
    return client.post(
        "/api/payments/",
        data={
            "order": order.id,
            "amount": amount,
            "method": method,
            "paid_at": "2026-07-06",
        },
        content_type="application/json",
    )


def _os(client, order):
    return client.get(f"/api/work-orders/{order.id}/").json()


def test_register_payment_requires_authentication(client, work_order):
    assert _pay(client, work_order, "50.00").status_code in (401, 403)


def test_new_order_starts_open_with_full_balance(auth_client, work_order):
    body = _os(auth_client, work_order)
    assert body["final_value"] == "160.00"
    assert body["amount_paid"] == "0.00"
    assert body["balance_due"] == "160.00"
    assert body["payment_status"] == "open"


def test_partial_then_full_payment_updates_status(auth_client, work_order):
    assert _pay(auth_client, work_order, "100.00").status_code == 201
    body = _os(auth_client, work_order)
    assert body["amount_paid"] == "100.00"
    assert body["balance_due"] == "60.00"
    assert body["payment_status"] == "partial"

    assert _pay(auth_client, work_order, "60.00").status_code == 201
    body = _os(auth_client, work_order)
    assert body["amount_paid"] == "160.00"
    assert body["balance_due"] == "0.00"
    assert body["payment_status"] == "paid"


def test_amount_must_be_positive(auth_client, work_order):
    assert _pay(auth_client, work_order, "0").status_code == 400
    assert _pay(auth_client, work_order, "-10").status_code == 400


def test_list_payments_by_order(auth_client, work_order):
    _pay(auth_client, work_order, "40.00")
    _pay(auth_client, work_order, "20.00", method="cash")
    response = auth_client.get(f"/api/payments/?order={work_order.id}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_payment_restores_balance(auth_client, work_order):
    created = _pay(auth_client, work_order, "100.00").json()
    response = auth_client.delete(f"/api/payments/{created['id']}/")
    assert response.status_code == 204
    body = _os(auth_client, work_order)
    assert body["amount_paid"] == "0.00"
    assert body["payment_status"] == "open"


def test_receivables_lists_orders_with_balance(auth_client, work_order):
    _pay(auth_client, work_order, "100.00")  # saldo 60 -> aparece
    response = auth_client.get("/api/payments/receivables/")
    assert response.status_code == 200
    data = response.json()
    ids = {row["id"] for row in data["results"]}
    assert work_order.id in ids
    row = next(r for r in data["results"] if r["id"] == work_order.id)
    assert row["balance_due"] == "60.00"
    assert data["total_receivable"] == "60.00"


def test_receivables_excludes_fully_paid_and_canceled(auth_client, work_order):
    _pay(auth_client, work_order, "160.00")  # quitada -> some
    response = auth_client.get("/api/payments/receivables/")
    ids = {row["id"] for row in response.json()["results"]}
    assert work_order.id not in ids

    # Canceladas nunca entram em recebíveis, mesmo com saldo.
    canceled = WorkOrder.objects.create(
        customer=work_order.customer,
        vehicle=work_order.vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        status=WorkOrder.Status.CANCELED,
    )
    response = auth_client.get("/api/payments/receivables/")
    ids = {row["id"] for row in response.json()["results"]}
    assert canceled.id not in ids


def test_payment_records_os_events(auth_client, work_order):
    created = _pay(auth_client, work_order, "50.00").json()
    assert OrderEvent.objects.filter(
        order=work_order, event_type=OrderEvent.Type.PAYMENT_REGISTERED
    ).exists()
    auth_client.delete(f"/api/payments/{created['id']}/")
    assert OrderEvent.objects.filter(
        order=work_order, event_type=OrderEvent.Type.PAYMENT_REMOVED
    ).exists()


def test_view_permission_can_list_but_not_register(work_order):
    # Usuário sem perfil, com apenas financial.view concedido.
    viewer = User.objects.create_user(
        email="viewer@example.com", password="StrongPass123", full_name="Viewer"
    )
    perm = Permission.objects.get(codename="financial.view")
    UserPermission.objects.create(
        user=viewer, permission=perm, grant_type=UserPermission.GrantType.GRANT
    )
    client = Client()
    client.post(
        "/api/auth/login/",
        data={"email": viewer.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    # Consegue ver recebíveis/pagamentos...
    assert client.get("/api/payments/receivables/").status_code == 200
    assert client.get(f"/api/payments/?order={work_order.id}").status_code == 200
    # ...mas não registrar (precisa de financial.register_payment).
    assert _pay(client, work_order, "10.00").status_code == 403
