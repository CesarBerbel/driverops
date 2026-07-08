import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import Role
from apps.ai_assistant.models import AISettings
from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def active_ai(db):
    conf = AISettings.get_solo()
    conf.is_active = True
    conf.provider = "anthropic"
    conf.save()
    return conf


def _login(client, email, password):
    client.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_user(db):
    # Administrador: ai.view + ai.use (não críticas); NÃO ai.edit/logs/test.
    u = User.objects.create_user(
        email="admin@example.com", password="StrongPass123", full_name="Ana Admin"
    )
    u.role = Role.objects.filter(key="administrador").first()
    u.save(update_fields=["role"])
    return u


@pytest.fixture
def admin_client(client, admin_user):
    return _login(client, admin_user.email, "StrongPass123")


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email="root@example.com", password="StrongPass123", full_name="Root"
    )


@pytest.fixture
def super_client(superuser):
    return _login(Client(), superuser.email, "StrongPass123")


@pytest.fixture
def tecnico_client(db):
    # Técnico: tem ai.use (mas não ai.view/edit/test/logs).
    u = User.objects.create_user(
        email="tec@example.com", password="StrongPass123", full_name="Téo"
    )
    u.role = Role.objects.filter(key="tecnico").first()
    u.save(update_fields=["role"])
    return _login(Client(), u.email, "StrongPass123")


@pytest.fixture
def estoque_client(db):
    # Estoque: sem nenhuma permissão de IA.
    u = User.objects.create_user(
        email="est@example.com", password="StrongPass123", full_name="Est"
    )
    u.role = Role.objects.filter(key="estoque").first()
    u.save(update_fields=["role"])
    return _login(Client(), u.email, "StrongPass123")


@pytest.fixture
def customer(db):
    return Customer.objects.create(name="Maria Silva", email="maria@example.com")


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer, license_plate="ABC1D23", brand="Fiat", model="Uno"
    )


@pytest.fixture
def work_order(db, customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="carro faz barulho estranho na frente",
        diagnosis="bieleta com folga",
        status="diagnosing",
    )
