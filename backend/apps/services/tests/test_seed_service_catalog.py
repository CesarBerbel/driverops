"""Catálogo dos 100 serviços mais realizados (peças obrigatórias/opcionais e
combos) -- comando seed_service_catalog. Não cria cliente, fornecedor nem OS."""

import pytest
from django.core.management import call_command

from apps.customers.models import Customer
from apps.orders.models import WorkOrder
from apps.parts.models import Part
from apps.services.models import (
    PackageService,
    Service,
    ServicePackage,
    ServicePart,
)
from apps.suppliers.models import Supplier

pytestmark = pytest.mark.django_db


def test_seed_creates_100_services_with_parts_and_combos():
    call_command("seed_service_catalog")

    assert Service.objects.count() == 100
    assert ServicePackage.objects.count() == 14
    assert PackageService.objects.exists()
    assert Part.objects.count() == 97
    # Todas as peças entram com estoque zerado.
    assert not Part.objects.exclude(current_quantity=0).exists()

    # Há peças padrão obrigatórias E opcionais (o vínculo carrega a exigência).
    assert ServicePart.objects.filter(is_required=True).exists()
    assert ServicePart.objects.filter(is_required=False).exists()

    # Exemplo concreto: amortecedor dianteiro (obrigatório) + itens opcionais.
    service = Service.objects.get(name="Troca de amortecedores dianteiros")
    links = {sp.part.internal_code: sp for sp in service.standard_parts.all()}
    assert links["AMORT-DIANT"].is_required is True
    assert links["AMORT-DIANT"].suggested_quantity == 1
    assert links["KIT-BATENTE"].is_required is False


def test_seed_does_not_create_customers_suppliers_or_orders():
    call_command("seed_service_catalog")

    assert Customer.objects.count() == 0
    assert Supplier.objects.count() == 0
    assert WorkOrder.objects.count() == 0


def test_seed_is_rerunnable_without_duplicating():
    call_command("seed_service_catalog")
    call_command("seed_service_catalog")

    assert Service.objects.count() == 100
    assert Part.objects.count() == 97
    assert ServicePackage.objects.count() == 14
    # As peças padrão são reconstruídas (não acumulam) a cada execução.
    service = Service.objects.get(name="Troca de óleo e filtro (sintético 5W30)")
    assert service.standard_parts.count() == 2
