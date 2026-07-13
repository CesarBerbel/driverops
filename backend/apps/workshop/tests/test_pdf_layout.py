"""Construtor de PDF da OS: layout por blocos (modelo, API e pré-visualização)."""

import pytest

from apps.workshop.models import OrderSettings, PdfLayoutSettings
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
        {"type": "text", "options": {"content": "oi"}},  # bloco removido -> descartado
        {"type": "spacer", "options": {"height": 999}},  # fora do limite -> fixado
        "garbage",
    ]
    blocks = normalize_blocks(raw)
    assert [b["type"] for b in blocks] == ["customer", "spacer"]
    # Campos filtrados aos válidos e em ordem canônica; desconhecido descartado.
    assert blocks[0]["options"]["fields"] == ["name", "email"]
    # height fora do limite é fixado ao teto (120).
    assert blocks[1]["options"]["height"] == 120


def test_text_blocks_are_no_longer_available():
    """Os blocos de texto (texto livre / faixa) saíram do construtor: o texto do
    PDF passa a ser editado em Configurações da OS."""
    from apps.workshop.pdf_blocks import BLOCK_TYPES

    assert "text" not in BLOCK_TYPES
    assert "band" not in BLOCK_TYPES
    # A barra e a assinatura não têm mais campo de texto no construtor.
    assert [o["key"] for o in BLOCK_TYPES["os_bar"]["options"]] == [
        "show_number",
        "show_emission",
    ]
    assert BLOCK_TYPES["signature"]["options"] == []


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
            {"type": "os_bar", "options": {"show_number": False, "label": "ignorado"}},
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
    # A barra só guarda os toggles; o campo de texto "label" foi descartado.
    assert saved.blocks[0]["options"] == {"show_number": False, "show_emission": True}
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
        "blocks": [{"type": "os_bar", "options": {"show_emission": False}}],
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


def test_preview_reflects_unsaved_texts(super_client):
    """A prévia usa os textos enviados (ainda não salvos) editados no construtor."""
    from io import BytesIO

    from pypdf import PdfReader

    _make_order()
    payload = {
        "texts": {
            "pdf_client_copy_label": "VIA PREVIA XYZ",
            "warranty_terms": "GARANTIA PREVIA XYZ",
        }
    }
    response = super_client.post(
        "/api/pdf-layout/preview/", data=payload, content_type="application/json"
    )
    assert response.status_code == 200
    text = "".join(
        p.extract_text() or "" for p in PdfReader(BytesIO(response.content)).pages
    )
    assert "VIA PREVIA XYZ" in text
    assert "GARANTIA PREVIA XYZ" in text
    # Nada foi salvo: o texto persistido continua o padrão.
    assert OrderSettings.get_solo().pdf_client_copy_label == "VIA DO CLIENTE"


def test_preview_without_any_order_returns_404(super_client):
    response = super_client.post(
        "/api/pdf-layout/preview/", data={}, content_type="application/json"
    )
    assert response.status_code == 404
