import pytest

from apps.categories.models import Category
from apps.parts.models import Part

from ..models import Service, ServicePart

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    assert client.get("/api/services/").status_code == 401


def test_create_requires_authentication(client, service_category):
    response = client.post(
        "/api/services/",
        data={"name": "Serviço", "category": service_category.id},
        content_type="application/json",
    )
    assert response.status_code == 401


def test_create_with_name_and_category_defaults_labor_to_zero(
    auth_client, service_category
):
    response = auth_client.post(
        "/api/services/",
        data={"name": "Revisão", "category": service_category.id},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Revisão"
    assert response.data["labor_cost"] == "0.00"
    assert response.data["value"] == "0.00"


def test_create_rejects_empty_name(auth_client, service_category):
    response = auth_client.post(
        "/api/services/",
        data={"name": "   ", "category": service_category.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_create_rejects_missing_category(auth_client):
    response = auth_client.post(
        "/api/services/",
        data={"name": "Sem categoria"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_create_rejects_non_service_category(auth_client, part_category):
    response = auth_client.post(
        "/api/services/",
        data={"name": "Errado", "category": part_category.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_create_rejects_inactive_category(auth_client, service_category):
    service_category.is_active = False
    service_category.save(update_fields=["is_active"])
    response = auth_client.post(
        "/api/services/",
        data={"name": "Serviço", "category": service_category.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_update_keeps_existing_inactive_category(auth_client, service):
    service.category.is_active = False
    service.category.save(update_fields=["is_active"])
    response = auth_client.patch(
        f"/api/services/{service.id}/",
        data={"labor_cost": "150.00"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["labor_cost"] == "150.00"


def test_update_rejects_reassigning_to_inactive_category(auth_client, service):
    other = Category.objects.create(
        category_type="service", name="Elétrica", is_active=False
    )
    response = auth_client.patch(
        f"/api/services/{service.id}/",
        data={"category": other.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_value_includes_standard_parts(auth_client, service_category, part):
    response = auth_client.post(
        "/api/services/",
        data={
            "name": "Troca de óleo",
            "category": service_category.id,
            "labor_cost": "100.00",
            "standard_parts": [{"part": part.id, "suggested_quantity": "2"}],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    # 100 labor + 2 x 50 sale_price = 200
    assert response.data["value"] == "200.00"
    assert response.data["standard_parts"][0]["part_name"] == "Filtro de óleo"


def test_value_zero_when_part_has_no_sale_price(
    auth_client, service_category, part_category
):
    part = Part.objects.create(category=part_category, name="Sem preço")
    response = auth_client.post(
        "/api/services/",
        data={
            "name": "Serviço",
            "category": service_category.id,
            "labor_cost": "0",
            "standard_parts": [{"part": part.id, "suggested_quantity": "3"}],
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["value"] == "0.00"


def test_rejects_negative_suggested_quantity(auth_client, service_category, part):
    response = auth_client.post(
        "/api/services/",
        data={
            "name": "Serviço",
            "category": service_category.id,
            "standard_parts": [{"part": part.id, "suggested_quantity": "-1"}],
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_rejects_duplicate_part(auth_client, service_category, part):
    response = auth_client.post(
        "/api/services/",
        data={
            "name": "Serviço",
            "category": service_category.id,
            "standard_parts": [
                {"part": part.id, "suggested_quantity": "1"},
                {"part": part.id, "suggested_quantity": "2"},
            ],
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "standard_parts" in response.data


def test_create_rejects_inactive_part_as_new_link(auth_client, service_category, part):
    part.is_active = False
    part.save(update_fields=["is_active"])
    response = auth_client.post(
        "/api/services/",
        data={
            "name": "Serviço",
            "category": service_category.id,
            "standard_parts": [{"part": part.id, "suggested_quantity": "1"}],
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "standard_parts" in response.data


def test_update_keeps_existing_part_after_it_is_disabled(
    auth_client, service_category, part
):
    service = Service.objects.create(name="Serviço", category=service_category)
    ServicePart.objects.create(service=service, part=part, suggested_quantity="2")
    part.is_active = False
    part.save(update_fields=["is_active"])
    # Re-sending the already-linked (now inactive) part must still pass.
    response = auth_client.patch(
        f"/api/services/{service.id}/",
        data={
            "labor_cost": "10.00",
            "standard_parts": [{"part": part.id, "suggested_quantity": "2"}],
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    assert len(response.data["standard_parts"]) == 1


def test_update_can_edit_quantity_and_remove_parts(auth_client, service_category, part):
    service = Service.objects.create(name="Serviço", category=service_category)
    ServicePart.objects.create(service=service, part=part, suggested_quantity="2")
    # Change quantity.
    response = auth_client.patch(
        f"/api/services/{service.id}/",
        data={"standard_parts": [{"part": part.id, "suggested_quantity": "5"}]},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["standard_parts"][0]["suggested_quantity"] == "5.00"
    # Remove all parts.
    response = auth_client.patch(
        f"/api/services/{service.id}/",
        data={"standard_parts": []},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["standard_parts"] == []


def test_destroy_soft_deletes(auth_client, service):
    response = auth_client.delete(f"/api/services/{service.id}/")
    assert response.status_code == 204
    service.refresh_from_db()
    assert service.is_active is False
    assert Service.objects.filter(pk=service.pk).exists()
    assert auth_client.get("/api/services/").data == []


def test_reactivate(auth_client, service):
    auth_client.delete(f"/api/services/{service.id}/")
    response = auth_client.post(f"/api/services/{service.id}/reactivate/")
    assert response.status_code == 200
    service.refresh_from_db()
    assert service.is_active is True


def test_status_filters(auth_client, service_category):
    active = Service.objects.create(name="Ativo", category=service_category)
    inactive = Service.objects.create(
        name="Inativo", category=service_category, is_active=False
    )
    names = {s["name"] for s in auth_client.get("/api/services/").data}
    assert active.name in names and inactive.name not in names
    names = {s["name"] for s in auth_client.get("/api/services/?status=inactive").data}
    assert inactive.name in names and active.name not in names
    names = {s["name"] for s in auth_client.get("/api/services/?status=all").data}
    assert active.name in names and inactive.name in names


def test_detail_route_ignores_status_filter(auth_client, service):
    auth_client.delete(f"/api/services/{service.id}/")
    response = auth_client.get(f"/api/services/{service.id}/")
    assert response.status_code == 200


def test_search_by_name_and_category(auth_client, service_category):
    Service.objects.create(name="Alinhamento", category=service_category)
    assert len(auth_client.get("/api/services/?search=Alinha").data) == 1
    assert len(auth_client.get("/api/services/?search=Mecânica").data) == 1
    assert len(auth_client.get("/api/services/?search=zzz").data) == 0
