"""Relatório financeiro de recebimentos (por período)."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.accounts.models import Permission, UserPermission
from apps.financial.models import Payment

pytestmark = pytest.mark.django_db

User = get_user_model()


def _pay(order, amount, method="pix", when=None):
    return Payment.objects.create(
        order=order,
        amount=amount,
        method=method,
        paid_at=when or timezone.localdate(),
    )


def test_report_requires_reports_permission(work_order):
    # Usuário com apenas financial.view (sem financial.reports).
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
    assert client.get("/api/payments/report/?period=month").status_code == 403


def test_report_totals_and_average_ticket(auth_client, work_order, customer, vehicle):
    from apps.orders.models import WorkOrder

    other = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    _pay(work_order, "100.00", "pix")
    _pay(work_order, "20.00", "cash")  # mesma OS
    _pay(other, "60.00", "pix")

    data = auth_client.get("/api/payments/report/?period=month").json()
    assert data["total_received"] == "180.00"
    assert data["payment_count"] == 3
    assert data["orders_count"] == 2  # duas OS distintas
    assert data["average_ticket"] == "90.00"  # 180 / 2


def test_report_by_method_breakdown(auth_client, work_order):
    _pay(work_order, "100.00", "pix")
    _pay(work_order, "30.00", "cash")
    data = auth_client.get("/api/payments/report/?period=month").json()
    methods = {m["method"]: m for m in data["by_method"]}
    assert methods["pix"]["total"] == "100.00"
    assert methods["cash"]["total"] == "30.00"
    # Ordenado por total desc: Pix (100) antes de Dinheiro (30).
    assert data["by_method"][0]["method"] == "pix"


def test_report_by_day_fills_the_period_range(auth_client, work_order):
    _pay(work_order, "50.00")
    data = auth_client.get("/api/payments/report/?period=week").json()
    # Uma entrada por dia da semana até hoje, dias sem pagamento = 0.
    total_days = sum(float(d["total"]) for d in data["by_day"])
    assert total_days == 50.0
    assert all("date" in d and "total" in d for d in data["by_day"])


def test_report_empty_period_is_zeroed(auth_client):
    data = auth_client.get("/api/payments/report/?period=today").json()
    assert data["total_received"] == "0.00"
    assert data["payment_count"] == 0
    assert data["average_ticket"] == "0.00"
    assert data["by_method"] == []
