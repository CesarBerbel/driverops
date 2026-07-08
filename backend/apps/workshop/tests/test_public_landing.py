"""Testes do endpoint público da landing institucional."""

import pytest
from django.test import Client

from apps.categories.models import Category
from apps.services.models import Service
from apps.workshop.models import WorkshopProfile

pytestmark = pytest.mark.django_db

URL = "/api/public/landing/"


def test_public_landing_is_accessible_without_auth():
    resp = Client().get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert "workshop" in body
    assert "services" in body


def test_public_landing_returns_workshop_data():
    profile = WorkshopProfile.get_solo()
    profile.trade_name = "Bandeirantes Auto Mecânica"
    profile.phone = "1133334444"
    profile.whatsapp = "11999998888"
    profile.city = "São Paulo"
    profile.state = "SP"
    profile.street = "Rua das Oficinas"
    profile.number = "100"
    profile.save()

    body = Client().get(URL).json()
    assert body["workshop"]["trade_name"] == "Bandeirantes Auto Mecânica"
    assert body["workshop"]["whatsapp"] == "11999998888"
    assert "Rua das Oficinas, 100" in body["workshop"]["address_line"]
    assert "São Paulo" in body["workshop"]["address_line"]


def test_public_landing_lists_only_active_services():
    cat = Category.objects.create(category_type="service", name="Mecânica")
    Service.objects.create(name="Diagnóstico automotivo", category=cat, is_active=True)
    Service.objects.create(name="Serviço oculto", category=cat, is_active=False)

    names = [s["name"] for s in Client().get(URL).json()["services"]]
    assert "Diagnóstico automotivo" in names
    assert "Serviço oculto" not in names


def test_public_landing_never_exposes_sensitive_fields():
    body = Client().get(URL).json()
    # Só campos institucionais públicos; nada de notas internas, IE, responsável.
    assert set(body["workshop"]).issubset(
        {
            "trade_name", "legal_name", "cnpj", "email", "phone", "whatsapp",
            "website", "business_hours", "logo", "address_line", "city", "state",
            "zip_code",
        }
    )
