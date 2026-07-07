"""Despesas da oficina + resultado do período (DRE)."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.accounts.models import Permission, UserPermission
from apps.financial.models import Expense, Payment

pytestmark = pytest.mark.django_db

User = get_user_model()


def _expense(client, description="Aluguel", amount="2000.00", category="rent"):
    return client.post(
        "/api/expenses/",
        data={
            "description": description,
            "amount": amount,
            "category": category,
            "method": "transfer",
            "incurred_at": timezone.localdate().isoformat(),
        },
        content_type="application/json",
    )


def _client_with(codenames):
    user = User.objects.create_user(
        email="fin@example.com", password="StrongPass123", full_name="Fin"
    )
    for code in codenames:
        UserPermission.objects.create(
            user=user,
            permission=Permission.objects.get(codename=code),
            grant_type=UserPermission.GrantType.GRANT,
        )
    client = Client()
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


def test_create_and_list_expense(auth_client):
    assert _expense(auth_client).status_code == 201
    response = auth_client.get("/api/expenses/?period=month")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category_display"] == "Aluguel"


def test_description_and_amount_are_validated(auth_client):
    assert _expense(auth_client, description=" ").status_code == 400
    assert _expense(auth_client, amount="0").status_code == 400
    assert _expense(auth_client, amount="-5").status_code == 400


def test_create_requires_register_expense_permission():
    # Só financial.view -> lista, mas não cria.
    client = _client_with(["financial.view"])
    assert client.get("/api/expenses/?period=month").status_code == 200
    assert _expense(client).status_code == 403


def test_list_filters_by_category(auth_client):
    _expense(auth_client, description="Aluguel", category="rent")
    _expense(auth_client, description="Peças", category="suppliers")
    response = auth_client.get("/api/expenses/?period=month&category=rent")
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["category"] == "rent"


def test_dre_computes_result(auth_client, work_order):
    Payment.objects.create(
        order=work_order, amount="3000.00", method="pix", paid_at=timezone.localdate()
    )
    Expense.objects.create(
        description="Aluguel",
        amount="2000.00",
        category="rent",
        incurred_at=timezone.localdate(),
    )
    Expense.objects.create(
        description="Peças",
        amount="500.00",
        category="suppliers",
        incurred_at=timezone.localdate(),
    )
    data = auth_client.get("/api/expenses/dre/?period=month").json()
    assert data["total_revenue"] == "3000.00"
    assert data["total_expenses"] == "2500.00"
    assert data["result"] == "500.00"
    by_cat = {c["category"]: c["total"] for c in data["expenses_by_category"]}
    assert by_cat["rent"] == "2000.00"
    assert by_cat["suppliers"] == "500.00"


def test_dre_result_can_be_negative(auth_client):
    Expense.objects.create(
        description="Aluguel",
        amount="800.00",
        category="rent",
        incurred_at=timezone.localdate(),
    )
    data = auth_client.get("/api/expenses/dre/?period=month").json()
    assert data["total_revenue"] == "0.00"
    assert data["result"] == "-800.00"


def test_dre_requires_reports_permission():
    client = _client_with(["financial.view", "financial.register_expense"])
    assert client.get("/api/expenses/dre/?period=month").status_code == 403
