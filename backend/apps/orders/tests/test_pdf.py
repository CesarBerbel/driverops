"""PDF da Ordem de Serviço."""

import pytest

from apps.orders.models import WorkOrder, WorkOrderPart

pytestmark = pytest.mark.django_db


@pytest.fixture
def order(db, customer, vehicle):
    o = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    WorkOrderPart.objects.create(
        order=o, description="Peça avulsa", quantity="1", unit_price="160.00"
    )
    return o


def test_pdf_returns_a_pdf(auth_client, order):
    response = auth_client.get(f"/api/work-orders/{order.id}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content[:5] == b"%PDF-"
    assert f"os-{order.number:04d}.pdf" in response["Content-Disposition"]


def test_pdf_requires_authentication(client, order):
    assert client.get(f"/api/work-orders/{order.id}/pdf/").status_code in (401, 403)
