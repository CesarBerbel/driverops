import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import Role
from apps.customers.models import Customer
from apps.leads.models import SiteLead
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
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


@pytest.fixture
def atendente_client(db):
    # Atendente: leads.view/attend/convert.
    u = User.objects.create_user(
        email="rec@example.com", password="StrongPass123", full_name="Rec"
    )
    u.role = Role.objects.filter(key="atendente").first()
    u.save(update_fields=["role"])
    return _login(Client(), u.email)


@pytest.fixture
def super_client(db):
    User.objects.create_superuser(
        email="root@example.com", password="StrongPass123", full_name="Root"
    )
    return _login(Client(), "root@example.com")


@pytest.fixture
def estoque_client(db):
    # Estoque: sem permissões de leads.
    u = User.objects.create_user(
        email="est@example.com", password="StrongPass123", full_name="Est"
    )
    u.role = Role.objects.filter(key="estoque").first()
    u.save(update_fields=["role"])
    return _login(Client(), u.email)


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        name="Maria Silva",
        phone="11988887777",
        whatsapp="11988887777",
        email="maria@example.com",
    )


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer,
        license_plate="ABC1D23",
        brand="Fiat",
        model="Uno",
        model_year=2020,
    )


@pytest.fixture
def lead(db):
    return SiteLead.objects.create(
        name="João Souza",
        phone="11999998888",
        email="joao@example.com",
        vehicle_plate="XYZ4A56",
        vehicle_brand="VW",
        vehicle_model="Gol",
        request_type="diagnostic",
        message="Barulho na frente",
        consent=True,
    )
