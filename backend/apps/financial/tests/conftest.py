import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.accounts.models import Role
from apps.customers.models import Customer
from apps.orders.models import WorkOrder, WorkOrderPart
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    u = User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )
    # Perfil Administrador -> tem financial.view e financial.register_payment.
    u.role = Role.objects.filter(key="administrador").first()
    u.save(update_fields=["role"])
    return u


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
    return Customer.objects.create(name="Maria Silva", whatsapp="11987654321")


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer, license_plate="ABC1234", brand="Fiat", model="Uno"
    )


@pytest.fixture
def work_order(db, customer, vehicle):
    """OS com um item de peça avulsa -> valor final R$ 160,00."""
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Troca de peça",
        status="ready",
    )
    WorkOrderPart.objects.create(
        order=order, description="Peça avulsa", quantity="1", unit_price="160.00"
    )
    return order
