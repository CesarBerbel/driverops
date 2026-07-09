from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from apps.accounts.models import Role
from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.quotes.models import Quote
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_cache():
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


def _user(email, role_key=None, *, is_superuser=False):
    if is_superuser:
        u = User.objects.create_superuser(
            email=email, password="StrongPass123", full_name="Root"
        )
    else:
        u = User.objects.create_user(
            email=email, password="StrongPass123", full_name=email.split("@")[0]
        )
    if role_key:
        u.role = Role.objects.filter(key=role_key).first()
        u.save(update_fields=["role"])
    return u


@pytest.fixture
def atendente_client(db):
    _user("aten@example.com", "atendente")
    return _login(Client(), "aten@example.com")


@pytest.fixture
def tecnico_client(db):
    _user("tec@example.com", "tecnico")
    return _login(Client(), "tec@example.com")


@pytest.fixture
def super_client(db):
    _user("root@example.com", is_superuser=True)
    return _login(Client(), "root@example.com")


@pytest.fixture
def estoque_client(db):
    _user("est@example.com", "estoque")  # sem permissões de crm
    return _login(Client(), "est@example.com")


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        name="Maria Silva", phone="11988887777", whatsapp="11988887777"
    )


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer, license_plate="ABC1D23", brand="VW", model="Gol"
    )


@pytest.fixture
def order(db, customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at=date.today(), customer_report="x"
    )


def make_quote(order, *, status="sent", sent_days_ago=3, valid_until=None):
    q = Quote.objects.create(work_order=order, status=status, valid_until=valid_until)
    if sent_days_ago is not None:
        Quote.objects.filter(pk=q.pk).update(
            sent_at=timezone.now() - timedelta(days=sent_days_ago)
        )
        q.refresh_from_db()
    return q
