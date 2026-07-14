"""Marcas de carro para autocomplete (tabela auxiliar oculta VehicleBrand)."""

import pytest

pytestmark = pytest.mark.django_db


def test_vehicle_brands_list_for_autocomplete(auth_client):
    response = auth_client.get("/api/vehicle-brands/")
    assert response.status_code == 200

    names = [b["name"] for b in response.json()]  # lista simples, sem paginação
    for brand in ("Chevrolet", "Volkswagen", "Fiat", "Toyota", "Fiat"):
        assert brand in names
    assert len(names) >= 60
    # Ordenadas por nome.
    assert names == sorted(names)


def test_vehicle_brands_requires_authentication(client):
    assert client.get("/api/vehicle-brands/").status_code in (401, 403)


def test_brand_field_still_accepts_a_custom_value(auth_client, customer):
    """As marcas são só sugestões: a marca do veículo continua texto livre."""
    response = auth_client.post(
        "/api/vehicles/",
        data={
            "customer": customer.id,
            "license_plate": "ABC1D23",
            "brand": "Marca Exótica Inexistente",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["brand"] == "Marca Exótica Inexistente"
