"""Testes do Cliente 360°: visão geral, permissões, financeiro, interações, timeline."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.accounts.models import AuditLog, Role
from apps.customers.models import Customer, CustomerInteraction
from apps.financial.models import Payment
from apps.orders.models import WorkOrder
from apps.quotes.models import Quote
from apps.vehicles.models import Vehicle

pytestmark = pytest.mark.django_db

User = get_user_model()


def _client(role_key=None):
    email = f"{role_key or 'nobody'}@example.com"
    u = User.objects.create_user(email=email, password="StrongPass123", full_name=email)
    if role_key:
        u.role = Role.objects.filter(key=role_key).first()
        u.save(update_fields=["role"])
    c = Client()
    c.post(
        "/api/auth/login/",
        data={"email": email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return c


@pytest.fixture
def customer360(db):
    c = Customer.objects.create(
        name="Maria Silva", phone="11988887777", whatsapp="11988887777"
    )
    v = Vehicle.objects.create(
        customer=c, license_plate="ABC1D23", brand="VW", model="Gol"
    )
    o = WorkOrder.objects.create(
        customer=c, vehicle=v, opened_at=date.today(), customer_report="barulho"
    )
    Quote.objects.create(work_order=o, status="sent", sent_at=timezone.now())
    Payment.objects.create(
        order=o, amount=Decimal("150.00"), method="pix", paid_at=date.today()
    )
    return c


def test_360_overview(auth_client, customer360):
    resp = auth_client.get(f"/api/customers/{customer360.id}/360/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["customer"]["name"] == "Maria Silva"
    assert body["summary"]["vehicles"] == 1
    assert body["summary"]["open_os"] == 1
    assert body["summary"]["pending_quotes"] == 1
    assert any(a["type"] == "open_os" for a in body["alerts"])
    assert body["can_financial"] is True  # administrador tem financial.view
    assert AuditLog.objects.filter(action="customer.view_360").exists()


def test_360_requires_customers_view(customer360):
    # Estoque não tem customers.view.
    assert (
        _client("estoque").get(f"/api/customers/{customer360.id}/360/").status_code
        == 403
    )


def test_financial_summary_permission(auth_client, customer360):
    # Administrador (financial.view) enxerga; Técnico (sem financial.view) não.
    ok = auth_client.get(f"/api/customers/{customer360.id}/financial-summary/")
    assert ok.status_code == 200
    assert ok.json()["paid_value"] == "150.00"
    assert (
        _client("tecnico")
        .get(f"/api/customers/{customer360.id}/financial-summary/")
        .status_code
        == 403
    )


def test_360_hides_financial_from_technician(customer360):
    resp = _client("tecnico").get(f"/api/customers/{customer360.id}/360/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["can_financial"] is False
    assert body["summary"]["total_value"] is None


def test_interactions_create_and_list(auth_client, customer360):
    post = auth_client.post(
        f"/api/customers/{customer360.id}/interactions/",
        data={
            "interaction_type": "call",
            "summary": "Cliente pediu retorno amanhã",
            "status": "awaiting",
        },
        content_type="application/json",
    )
    assert post.status_code == 201
    assert CustomerInteraction.objects.filter(customer=customer360).count() == 1
    assert AuditLog.objects.filter(action="customer.interaction.create").exists()

    lst = auth_client.get(f"/api/customers/{customer360.id}/interactions/")
    assert lst.status_code == 200
    assert lst.json()[0]["summary"] == "Cliente pediu retorno amanhã"


def test_interaction_requires_summary(auth_client, customer360):
    resp = auth_client.post(
        f"/api/customers/{customer360.id}/interactions/",
        data={"interaction_type": "note", "summary": ""},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_orders_and_quotes_lists(auth_client, customer360):
    orders = auth_client.get(f"/api/customers/{customer360.id}/work-orders/")
    assert orders.status_code == 200 and len(orders.json()) == 1
    quotes = auth_client.get(f"/api/customers/{customer360.id}/quotes/")
    assert quotes.status_code == 200 and quotes.json()[0]["status"] == "sent"


def test_timeline(auth_client, customer360):
    resp = auth_client.get(f"/api/customers/{customer360.id}/timeline/")
    assert resp.status_code == 200
    types = {e["type"] for e in resp.json()}
    assert "customer" in types and "order" in types and "quote_sent" in types
    # Financeiro só aparece para quem tem permissão (administrador tem).
    assert "payment" in types
