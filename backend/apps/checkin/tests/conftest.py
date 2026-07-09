from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import Role
from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    # Sem isto, o throttle de login (5/min) acumula entre testes e derruba os logins.
    cache.clear()
    yield
    cache.clear()


def _login(client, email, password="StrongPass123"):
    client.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return client


def _user(email, role_key=None, *, is_superuser=False, password="StrongPass123"):
    if is_superuser:
        u = User.objects.create_superuser(
            email=email, password=password, full_name="Root"
        )
    else:
        u = User.objects.create_user(
            email=email, password=password, full_name=email.split("@")[0]
        )
    if role_key:
        u.role = Role.objects.filter(key=role_key).first()
        u.save(update_fields=["role"])
    return u


@pytest.fixture
def order(db):
    c = Customer.objects.create(name="Cliente")
    v = Vehicle.objects.create(
        customer=c, license_plate="CKI1A23", brand="VW", model="Gol"
    )
    return WorkOrder.objects.create(
        customer=c, vehicle=v, opened_at=date.today(), customer_report="barulho"
    )


@pytest.fixture
def atendente_client(db):
    # Atendente: checkin view/edit/complete (não tem reopen).
    _user("aten@example.com", "atendente")
    return _login(Client(), "aten@example.com")


@pytest.fixture
def tecnico_client(db):
    # Técnico: checkin view/edit (sem complete/reopen).
    _user("tec@example.com", "tecnico")
    return _login(Client(), "tec@example.com")


@pytest.fixture
def super_client(db):
    _user("root@example.com", is_superuser=True)
    return _login(Client(), "root@example.com")


@pytest.fixture
def estoque_client(db):
    # Estoque: sem permissões de checkin.
    _user("est@example.com", "estoque")
    return _login(Client(), "est@example.com")
