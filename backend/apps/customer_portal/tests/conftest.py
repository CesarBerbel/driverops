import pytest
from django.core.cache import cache

from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.vehicles.models import Vehicle


@pytest.fixture(autouse=True)
def _portal_env(settings):
    # E-mail em memória (mail.outbox) e throttle limpo entre testes.
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        name="João Silva", customer_type="individual", email="joao@example.com"
    )


@pytest.fixture
def vehicle(db, customer):
    return Vehicle.objects.create(
        customer=customer, license_plate="ABC1D23", brand="VW", model="Gol"
    )


@pytest.fixture
def order(db, customer, vehicle):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        status="in_progress",
        customer_report="Barulho na frente",
        diagnosis="Amortecedor gasto",
        internal_notes="SEGREDO INTERNO: margem alta nesta peca",
    )
