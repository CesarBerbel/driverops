"""PDF da Ordem de Serviço."""

import pytest

from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
from apps.orders.pdf import build_order_pdf_context, render_order_pdf
from apps.workshop.models import OrderSettings, WorkshopProfile

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


def test_context_formats_workshop_and_includes_all_terms(db, customer, vehicle):
    """Cabeçalho da oficina com dados formatados e TODOS os termos preenchidos
    (garantia e ciência do cliente antes ficavam de fora do PDF)."""
    p = WorkshopProfile.get_solo()
    p.cnpj = "12345678000190"
    p.phone = "1140028922"
    p.zip_code = "01310100"
    p.street = "Av. Paulista"
    p.number = "1000"
    p.neighborhood = "Bela Vista"
    p.city = "Sao Paulo"
    p.state = "SP"
    p.save()
    s = OrderSettings.get_solo()
    s.service_authorization_terms = "Autorizo."
    s.warranty_terms = "Garantia de 90 dias."
    s.customer_acknowledgment_terms = "Ciente."
    s.general_conditions = ""  # vazio nao entra
    s.save()

    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04"
    )
    order.refresh_from_db()
    ctx = build_order_pdf_context(order)

    assert ctx["workshop"]["cnpj"] == "12.345.678/0001-90"
    assert ctx["workshop"]["phone"] == "(11) 4002-8922"
    assert "CEP 01310-100" in ctx["workshop"]["address"]
    # Termos preenchidos entram na ordem certa; o vazio (condicoes gerais) nao.
    assert [t["title"] for t in ctx["terms"]] == [
        "Autorização de serviço",
        "Garantia",
        "Ciência do cliente",
    ]


def test_vehicle_fields_hide_empty(db, customer):
    """Só campos de veículo preenchidos entram na ficha (o resto some)."""
    from apps.vehicles.models import Vehicle

    v = Vehicle.objects.create(
        customer=customer, license_plate="XYZ9K88", brand="Fiat", model="Uno"
    )
    order = WorkOrder.objects.create(customer=customer, vehicle=v, opened_at="2026-07-04")
    order.refresh_from_db()

    ctx = build_order_pdf_context(order)
    labels = [c["label"] for row in ctx["vehicle_field_rows"] for c in row if c]

    assert labels == ["Placa", "Fabricante", "Modelo"]
    for empty in ["Combustível", "Câmbio", "Direção", "Portas", "Cor", "KM", "Ano"]:
        assert empty not in labels


def test_pdf_shows_client_copy_and_no_status(db, customer, vehicle):
    """O PDF traz 'VIA DO CLIENTE' e NÃO mostra mais o status da OS."""
    from django.template.loader import render_to_string

    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        status="in_progress",
    )
    order.refresh_from_db()

    html = render_to_string("orders/order_pdf.html", build_order_pdf_context(order))
    assert "VIA DO CLIENTE" in html
    assert order.get_status_display() not in html  # "Em execução" não aparece
    # Via do cliente não mostra pago/saldo/status de pagamento.
    assert "Pago:" not in html
    assert "Saldo:" not in html
    assert "Valor total" in html  # o total continua


def test_term_html_formats_bullets():
    from apps.orders.pdf import _term_html

    out = _term_html("Intro: - primeiro item; - segundo item.")
    assert out.count("•") == 2
    assert "<br/>" in out
    # Termo sem lista fica como parágrafo simples (sem marcador).
    assert "•" not in _term_html("Autorizo a execução dos serviços.")
    assert _term_html("") == ""
