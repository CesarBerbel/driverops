import pytest

from apps.workshop.models import OrderSettings, WorkshopProfile

pytestmark = pytest.mark.django_db


# --- Dados da Oficina (WorkshopProfile) ---


def test_workshop_profile_requires_authentication(client):
    response = client.get("/api/workshop-profile/")
    assert response.status_code in (401, 403)


def test_get_creates_and_returns_singleton_defaults(auth_client):
    response = auth_client.get("/api/workshop-profile/")
    assert response.status_code == 200
    assert response.json()["country"] == "Brasil"
    assert WorkshopProfile.objects.count() == 1


def test_authenticated_non_superuser_cannot_edit(auth_client):
    response = auth_client.patch(
        "/api/workshop-profile/",
        data={"trade_name": "Hack"},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_superuser_updates_and_normalizes_brazilian_fields(super_client):
    response = super_client.patch(
        "/api/workshop-profile/",
        data={
            "trade_name": "  Oficina Central  ",
            "cnpj": "11.222.333/0001-81",
            "phone": "(11) 3333-4444",
            "zip_code": "01001-000",
            "state": "sp",
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["trade_name"] == "Oficina Central"
    assert body["cnpj"] == "11222333000181"
    assert body["phone"] == "1133334444"
    assert body["zip_code"] == "01001000"
    assert body["state"] == "SP"


def test_trade_name_is_required(super_client):
    response = super_client.patch(
        "/api/workshop-profile/",
        data={"trade_name": "   "},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "trade_name" in response.json()


def test_invalid_cnpj_rejected(super_client):
    response = super_client.patch(
        "/api/workshop-profile/",
        data={"trade_name": "Oficina", "cnpj": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "cnpj" in response.json()


def test_profile_stays_a_singleton(super_client):
    for name in ("A", "B", "C"):
        super_client.patch(
            "/api/workshop-profile/",
            data={"trade_name": name},
            content_type="application/json",
        )
    assert WorkshopProfile.objects.count() == 1
    assert WorkshopProfile.get_solo().trade_name == "C"


# --- Configurações da OS (OrderSettings) ---


def test_order_settings_defaults(auth_client):
    response = auth_client.get("/api/order-settings/")
    assert response.status_code == 200
    body = response.json()
    assert body["default_delivery_days"] == 7
    assert body["warranty_terms"]  # seeded, non-empty
    assert body["pdf_footer_text"]


def test_order_settings_write_requires_superuser(auth_client):
    response = auth_client.patch(
        "/api/order-settings/",
        data={"default_delivery_days": 3},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_order_settings_allows_zero_days(super_client):
    response = super_client.patch(
        "/api/order-settings/",
        data={"default_delivery_days": 0},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["default_delivery_days"] == 0


def test_order_settings_rejects_negative_days(super_client):
    response = super_client.patch(
        "/api/order-settings/",
        data={"default_delivery_days": -5},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_order_settings_preserves_line_breaks(super_client):
    terms = "Linha 1\nLinha 2\n\nLinha 4"
    response = super_client.patch(
        "/api/order-settings/",
        data={"warranty_terms": terms},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["warranty_terms"] == terms
    assert OrderSettings.get_solo().warranty_terms == terms
