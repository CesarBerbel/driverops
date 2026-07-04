import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.customers.models import Customer
from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )


@pytest.fixture
def auth_client(client, user):
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        name="Maria Silva", whatsapp="11987654321", email="maria@example.com"
    )


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer, license_plate="ABC1D23", brand="Honda", model="Fit"
    )


@pytest.fixture
def work_order(db, customer, vehicle):
    """OS com 1 serviço avulso (R$ 100) e 1 peça avulsa (2 × R$ 50)."""
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Barulho ao frear",
        diagnosis="Pastilhas gastas",
        status="awaiting_approval",
    )
    WorkOrderService.objects.create(
        order=order, description="Troca de pastilhas", quantity=1, unit_price=100
    )
    WorkOrderPart.objects.create(
        order=order, description="Pastilha dianteira", quantity=2, unit_price=50
    )
    return order
