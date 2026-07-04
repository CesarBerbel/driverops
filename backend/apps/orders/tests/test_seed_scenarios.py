import pytest
from django.core.management import call_command

from apps.orders.models import WorkOrder
from apps.orders.serializers import WorkOrderSerializer
from apps.parts.models import Part
from apps.services.models import Service, ServicePackage

pytestmark = pytest.mark.django_db


def _final_by_plate():
    orders = WorkOrder.objects.select_related("vehicle").prefetch_related(
        "service_items", "package_items", "part_items"
    )
    serializer = WorkOrderSerializer()
    return {o.vehicle.license_plate: serializer.get_final_value(o) for o in orders}


def test_seed_creates_the_ten_scenarios_with_correct_totals():
    call_command("seed_scenarios")

    assert WorkOrder.objects.count() == 10
    assert Part.objects.filter(internal_code__startswith="P-").count() == 10
    assert Service.objects.count() >= 7
    assert ServicePackage.objects.count() >= 4

    finals = _final_by_plate()
    assert finals["ABC1D23"] == "327.00"  # revisão básica + peças padrão
    assert finals["BRA2E19"] == "860.00"  # pacote de freio + desconto fixo 45
    assert finals["QWE3R45"] == "1000.00"  # serviço + peça avulsos
    assert finals["FRT8H22"] == "1000.00"  # correia + desconto fixo 30
    assert finals["JKL5M67"] == "800.00"  # revisão completa + desconto fixo 62
    assert finals["RTY6U44"] == "250.00"  # pacote avulso
    assert finals["KLM9N88"] == "0.00"  # serviço avulso sem valor


def test_seed_marks_avulso_lines_as_custom():
    call_command("seed_scenarios")
    order = WorkOrder.objects.get(vehicle__license_plate="QWE3R45")

    services = {s.description: s for s in order.service_items.all()}
    assert services["Diagnóstico eletrônico com scanner"].service_id is not None
    assert services["Teste cruzado de bobina e chicote de ignição"].service_id is None

    parts = {p.description: p for p in order.part_items.all()}
    assert parts["Jogo de velas NGK Iridium"].part_id is not None
    assert parts["Bobina de ignição cilindro 2 HB20 1.0"].part_id is None


def test_seed_is_rerunnable_without_duplicating():
    call_command("seed_scenarios")
    call_command("seed_scenarios")

    assert WorkOrder.objects.count() == 10
    assert Part.objects.filter(internal_code="P-OL-5W30-001").count() == 1
    assert Service.objects.filter(name="Troca de óleo do motor").count() == 1
