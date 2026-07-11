"""PDF da Ordem de Serviço."""

import pytest

from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
from apps.orders.pdf import build_order_pdf_context, render_order_pdf

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


def test_line_rows_nest_parts_under_their_service(db, customer, vehicle):
    """A peça vinculada a um serviço aparece aninhada logo abaixo dele, numa
    lista ÚNICA (sem separar serviços de peças); a peça avulsa fica no fim."""
    o = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04"
    )
    service = WorkOrderService.objects.create(
        order=o, description="Troca de óleo", quantity="1", unit_price="120.00"
    )
    WorkOrderPart.objects.create(
        order=o,
        description="Óleo 5W30",
        quantity="4",
        unit_price="40.00",
        linked_service=service,
    )
    WorkOrderPart.objects.create(
        order=o, description="Palheta", quantity="1", unit_price="30.00"
    )
    o.refresh_from_db()  # datas viram objetos date (não a string passada no create)

    ctx = build_order_pdf_context(o)

    # Sem seções separadas (groups): tudo numa única lista de linhas.
    assert "groups" not in ctx
    kinds = [row["kind"] for row in ctx["line_rows"]]
    assert kinds == ["service", "part_child", "part"]
    # A peça-filha carrega o nome do serviço a que pertence.
    assert ctx["line_rows"][1]["service_name"] == "Troca de óleo"
    # E o PDF renderiza sem erro.
    assert render_order_pdf(o)[:5] == b"%PDF-"
