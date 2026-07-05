import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.categories.models import Category
from apps.customers.models import Customer
from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
from apps.parts.models import Part
from apps.services.models import Service, ServicePart
from apps.vehicles.models import Vehicle

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    from apps.accounts.models import Role

    u = User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )
    # Perfil Administrador (semeado) -> permissões amplas dos módulos de domínio.
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


@pytest.fixture
def linked_work_order(db, customer, vehicle):
    """OS com um serviço de catálogo que tem uma peça padrão, e essa mesma peça
    como linha de peça -- a peça deve ficar vinculada ao serviço no orçamento.
    Inclui ainda uma peça avulsa independente."""
    service_category = Category.objects.create(category_type="service", name="Freios")
    part_category = Category.objects.create(category_type="part", name="Pastilhas")
    part = Part.objects.create(
        category=part_category, name="Pastilha dianteira", sale_price="50.00"
    )
    service = Service.objects.create(
        name="Troca de pastilhas", category=service_category, labor_cost="100.00"
    )
    ServicePart.objects.create(service=service, part=part, suggested_quantity=2)

    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Freio barulhento",
        status="awaiting_approval",
    )
    WorkOrderService.objects.create(
        order=order, service=service, quantity=1, unit_price=100
    )
    WorkOrderPart.objects.create(order=order, part=part, quantity=2, unit_price=50)
    # Peça avulsa independente (não vinculada a nenhum serviço).
    WorkOrderPart.objects.create(
        order=order, description="Fluido de freio", quantity=1, unit_price=30
    )
    return order
