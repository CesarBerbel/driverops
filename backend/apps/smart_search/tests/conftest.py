import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import Permission, UserPermission
from apps.customers.models import Customer
from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
from apps.vehicles.models import Vehicle

User = get_user_model()

# Conjunto amplo de permissões de leitura (usuário "poder total" nos testes).
ALL_VIEW_CODES = [
    "orders.view",
    "orders.edit",
    "customers.view",
    "vehicles.view",
    "leads.view",
    "financial.view",
]


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def _grant(user, codes):
    for code in codes:
        perm = Permission.objects.get(codename=code)
        UserPermission.objects.create(
            user=user, permission=perm, grant_type=UserPermission.GrantType.GRANT
        )


def make_user(email, codes):
    """Cria um usuário SEM papel e concede exatamente ``codes`` (via GRANT)."""
    user = User.objects.create_user(
        email=email, password="StrongPass123", full_name=email.split("@")[0]
    )
    _grant(user, codes)
    return user


def login(user):
    client = Client()
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def full_user(db):
    return make_user("full@example.com", ALL_VIEW_CODES)


@pytest.fixture
def full_client(full_user):
    return login(full_user)


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        name="João Silva", email="joao@example.com", phone="11988887777"
    )


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer,
        license_plate="ABC1D23",
        brand="Honda",
        model="Civic",
        color="Preto",
    )


@pytest.fixture
def work_order(db, customer, vehicle):
    wo = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2025-08-12",
        customer_report="a luz de freio permanece acesa mesmo com o carro desligado",
        diagnosis="sensor do pedal com defeito",
        internal_notes="cliente costuma reclamar de tudo",
        status="diagnosing",
    )
    WorkOrderService.objects.create(order=wo, description="Revisão completa")
    WorkOrderPart.objects.create(order=wo, description="Pastilha de freio dianteira")
    return wo
