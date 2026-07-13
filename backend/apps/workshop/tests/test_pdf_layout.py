"""Construtor de PDF da OS: layout por blocos (modelo, API e pré-visualização)."""

import pytest

from apps.workshop.models import PdfLayoutSettings
from apps.workshop.pdf_blocks import default_pdf_blocks, normalize_blocks

pytestmark = pytest.mark.django_db


def _make_order():
    """OS mínima (cliente + veículo) para a pré-visualização renderizar."""
    from apps.customers.models import Customer
    from apps.orders.models import WorkOrder
    from apps.vehicles.models import Vehicle

    customer = Customer.objects.create(name="Fulano")
    vehicle = Vehicle.objects.create(
        customer=customer, license_plate="ABC1D23", brand="Fiat", model="Uno"
    )
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04"
    )
    order.refresh_from_db()
    return order


def test_default_layout_reproduces_current_pdf():
    """O layout padrão é a sequência de blocos do PDF atual (sem os extras)."""
    types = [b["type"] for b in default_pdf_blocks()]
    assert types == [
        "header",
        "os_bar",
        "customer",
        "vehicle",
        "dates",
        "diagnosis",
        "items",
        "terms",
        "signature",
        "footer",
    ]
    # Opção sensível: a via do cliente NÃO mostra pago/saldo por padrão.
    items = next(b for b in default_pdf_blocks() if b["type"] == "items")
    assert items["options"]["show_payment"] is False


def test_normalize_drops_unknown_types_and_sanitizes_options():
    raw = [
        {"type": "customer", "options": {"fields": ["email", "name", "bogus"]}},
        {"type": "not_a_block", "options": {}},
        {
            "type": "text",
            "options": {"size": 999, "align": "diagonal", "content": "oi"},
        },
        "garbage",
    ]
    blocks = normalize_blocks(raw)
    assert [b["type"] for b in blocks] == ["customer", "text"]
    # Campos filtrados aos válidos e em ordem canônica; desconhecido descartado.
    assert blocks[0]["options"]["fields"] == ["name", "email"]
    # size fora do limite é fixado; align inválido cai no default.
    assert blocks[1]["options"]["size"] == 24
    assert blocks[1]["options"]["align"] == "left"


def test_get_returns_defaults_and_catalog(auth_client):
    response = auth_client.get("/api/pdf-layout/")
    assert response.status_code == 200
    data = response.json()
    assert [b["type"] for b in data["blocks"]][0] == "header"
    assert data["accent_color"] == "#e5e7eb"
    # O catálogo (somente leitura) alimenta o editor com os tipos/opções.
    assert {"type", "label", "options"} <= set(data["catalog"][0].keys())
    assert any(entry["type"] == "spacer" for entry in data["catalog"])


def test_patch_persists_reorder_and_normalizes(super_client):
    payload = {
        "blocks": [
            {"type": "os_bar", "options": {"label": "VIA DA OFICINA"}},
            {"type": "items", "options": {"show_payment": True}},
            {"type": "zzz", "options": {}},  # descartado
        ],
        "accent_color": "not-a-color",  # cai no padrão
        "base_font_size": 99,  # fixado ao teto (14)
    }
    response = super_client.patch(
        "/api/pdf-layout/", data=payload, content_type="application/json"
    )
    assert response.status_code == 200
    saved = PdfLayoutSettings.get_solo()
    assert [b["type"] for b in saved.blocks] == ["os_bar", "items"]
    assert saved.blocks[0]["options"]["label"] == "VIA DA OFICINA"
    assert saved.accent_color == "#e5e7eb"
    assert saved.base_font_size == 14.0


def test_patch_requires_superuser(auth_client):
    response = auth_client.patch(
        "/api/pdf-layout/", data={"blocks": []}, content_type="application/json"
    )
    assert response.status_code == 403


def test_preview_renders_pdf_with_unsaved_layout(super_client):
    _make_order()
    payload = {
        "blocks": [{"type": "text", "options": {"content": "PREVIA X", "size": 14}}],
        "accent_color": "#2a4fd6",
    }
    response = super_client.post(
        "/api/pdf-layout/preview/", data=payload, content_type="application/json"
    )
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content[:5] == b"%PDF-"
    # O layout enviado não é salvo (continua o padrão).
    assert [b["type"] for b in PdfLayoutSettings.get_solo().blocks][0] == "header"


def test_preview_without_any_order_returns_404(super_client):
    response = super_client.post(
        "/api/pdf-layout/preview/", data={}, content_type="application/json"
    )
    assert response.status_code == 404
