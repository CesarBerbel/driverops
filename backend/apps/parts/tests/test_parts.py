import pytest

from apps.categories.models import Category

from ..models import Part

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/parts/")
    assert response.status_code == 401


def test_create_requires_authentication(client, part_category):
    response = client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Vela de ignição"},
        content_type="application/json",
    )
    assert response.status_code == 401


def test_create_requires_category(auth_client):
    response = auth_client.post(
        "/api/parts/", data={"name": "Vela de ignição"}, content_type="application/json"
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_create_requires_name(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_create_with_minimum_fields(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Vela de ignição"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["category_name"] == "Motor"
    assert response.data["current_quantity"] == "0.00"
    assert response.data["unit_of_measure"] == "unit"
    assert response.data["is_low_stock"] is False


def test_create_rejects_non_part_category(auth_client):
    client_category = Category.objects.create(
        category_type="client", name="Cliente Padrão"
    )
    response = auth_client.post(
        "/api/parts/",
        data={"category": client_category.id, "name": "Teste"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_create_rejects_inactive_category(auth_client):
    inactive_category = Category.objects.create(
        category_type="part", name="Desabilitada", is_active=False
    )
    response = auth_client.post(
        "/api/parts/",
        data={"category": inactive_category.id, "name": "Teste"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_update_keeps_existing_inactive_category(auth_client, part_category):
    part = Part.objects.create(category=part_category, name="Filtro de óleo")
    part_category.is_active = False
    part_category.save(update_fields=["is_active"])

    response = auth_client.patch(
        f"/api/parts/{part.id}/",
        data={"brand": "Bosch"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["brand"] == "Bosch"
    assert response.data["category"] == part_category.id


def test_update_rejects_reassigning_to_inactive_category(auth_client, part_category):
    part = Part.objects.create(category=part_category, name="Filtro de óleo")
    other_inactive = Category.objects.create(
        category_type="part", name="Outra Desabilitada", is_active=False
    )

    response = auth_client.patch(
        f"/api/parts/{part.id}/",
        data={"category": other_inactive.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category" in response.data


def test_create_rejects_negative_current_quantity(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "current_quantity": "-5"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "current_quantity" in response.data


def test_create_rejects_negative_min_quantity(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "min_quantity": "-1"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "min_quantity" in response.data


def test_create_rejects_negative_cost_price(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "cost_price": "-10.00"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "cost_price" in response.data


def test_create_rejects_negative_sale_price(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "sale_price": "-10.00"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "sale_price" in response.data


def test_ncm_normalizes_to_digits_only(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "ncm": "8708.99.90"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["ncm"] == "87089990"


def test_ncm_rejects_wrong_length(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={"category": part_category.id, "name": "Teste", "ncm": "1234567"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "ncm" in response.data


def test_barcode_normalizes_to_digits_only(auth_client, part_category):
    response = auth_client.post(
        "/api/parts/",
        data={
            "category": part_category.id,
            "name": "Teste",
            "barcode": "789-1234-5678",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["barcode"] == "78912345678"


def test_text_fields_are_trimmed_and_internal_code_uppercased(
    auth_client, part_category
):
    response = auth_client.post(
        "/api/parts/",
        data={
            "category": part_category.id,
            "name": "Teste",
            "internal_code": "  pc-1234  ",
            "brand": "  Bosch  ",
            "location": "  Prateleira A3  ",
            "supplier": "  Fornecedor Ltda  ",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["internal_code"] == "PC-1234"
    assert response.data["brand"] == "Bosch"
    assert response.data["location"] == "Prateleira A3"
    assert response.data["supplier"] == "Fornecedor Ltda"


def test_list_includes_category_name(auth_client, part_category):
    Part.objects.create(category=part_category, name="Filtro de óleo")

    response = auth_client.get("/api/parts/")
    assert response.data[0]["category_name"] == "Motor"


def test_is_low_stock_true_when_at_or_below_min(auth_client, part_category):
    part = Part.objects.create(
        category=part_category, name="Pastilha", current_quantity="2", min_quantity="5"
    )
    response = auth_client.get(f"/api/parts/{part.id}/")
    assert response.data["is_low_stock"] is True


def test_is_low_stock_false_when_min_quantity_not_set(auth_client, part_category):
    part = Part.objects.create(
        category=part_category, name="Pastilha", current_quantity="0"
    )
    response = auth_client.get(f"/api/parts/{part.id}/")
    assert response.data["is_low_stock"] is False


def test_is_low_stock_false_when_comfortably_above_min(auth_client, part_category):
    part = Part.objects.create(
        category=part_category, name="Pastilha", current_quantity="50", min_quantity="5"
    )
    response = auth_client.get(f"/api/parts/{part.id}/")
    assert response.data["is_low_stock"] is False


def test_search_by_name(auth_client, part_category):
    Part.objects.create(category=part_category, name="Filtro de óleo")
    Part.objects.create(category=part_category, name="Pastilha de freio")

    response = auth_client.get("/api/parts/?search=filtro")
    names = [item["name"] for item in response.data]
    assert names == ["Filtro de óleo"]


def test_search_by_internal_code(auth_client, part_category):
    Part.objects.create(
        category=part_category, name="Filtro de óleo", internal_code="PC-1234"
    )
    Part.objects.create(
        category=part_category, name="Pastilha de freio", internal_code="PC-9999"
    )

    response = auth_client.get("/api/parts/?search=1234")
    names = [item["name"] for item in response.data]
    assert names == ["Filtro de óleo"]


def test_search_by_brand(auth_client, part_category):
    Part.objects.create(category=part_category, name="Filtro de óleo", brand="Bosch")
    Part.objects.create(
        category=part_category, name="Pastilha de freio", brand="Fras-le"
    )

    response = auth_client.get("/api/parts/?search=bosch")
    names = [item["name"] for item in response.data]
    assert names == ["Filtro de óleo"]


def test_search_by_category_name(auth_client):
    motor = Category.objects.create(category_type="part", name="Motor")
    suspensao = Category.objects.create(category_type="part", name="Suspensão")
    Part.objects.create(category=motor, name="Filtro de óleo")
    Part.objects.create(category=suspensao, name="Amortecedor")

    response = auth_client.get("/api/parts/?search=suspens")
    names = [item["name"] for item in response.data]
    assert names == ["Amortecedor"]


def test_category_filter(auth_client):
    motor = Category.objects.create(category_type="part", name="Motor")
    suspensao = Category.objects.create(category_type="part", name="Suspensão")
    Part.objects.create(category=motor, name="Filtro de óleo")
    Part.objects.create(category=suspensao, name="Amortecedor")

    response = auth_client.get(f"/api/parts/?category={motor.id}")
    names = [item["name"] for item in response.data]
    assert names == ["Filtro de óleo"]


def test_list_defaults_to_active_only(auth_client, part_category):
    Part.objects.create(category=part_category, name="Ativa", is_active=True)
    Part.objects.create(category=part_category, name="Inativa", is_active=False)

    response = auth_client.get("/api/parts/")
    names = [item["name"] for item in response.data]
    assert names == ["Ativa"]


def test_list_inactive_filter(auth_client, part_category):
    Part.objects.create(category=part_category, name="Ativa", is_active=True)
    Part.objects.create(category=part_category, name="Inativa", is_active=False)

    response = auth_client.get("/api/parts/?status=inactive")
    names = [item["name"] for item in response.data]
    assert names == ["Inativa"]


def test_list_all_filter(auth_client, part_category):
    Part.objects.create(category=part_category, name="Ativa", is_active=True)
    Part.objects.create(category=part_category, name="Inativa", is_active=False)

    response = auth_client.get("/api/parts/?status=all")
    names = sorted(item["name"] for item in response.data)
    assert names == ["Ativa", "Inativa"]


def test_destroy_soft_deletes_instead_of_removing_row(auth_client, part_category):
    part = Part.objects.create(category=part_category, name="Filtro de óleo")

    response = auth_client.delete(f"/api/parts/{part.id}/")
    assert response.status_code == 204

    part.refresh_from_db()
    assert part.is_active is False
    assert Part.objects.filter(pk=part.pk).exists()

    list_response = auth_client.get("/api/parts/")
    assert list_response.data == []


def test_reactivate_sets_is_active_true(auth_client, part_category):
    part = Part.objects.create(
        category=part_category, name="Filtro de óleo", is_active=False
    )

    response = auth_client.post(f"/api/parts/{part.id}/reactivate/")
    assert response.status_code == 200

    part.refresh_from_db()
    assert part.is_active is True


def test_detail_routes_ignore_status_filter(auth_client, part_category):
    part = Part.objects.create(
        category=part_category, name="Filtro de óleo", is_active=False
    )

    response = auth_client.get(f"/api/parts/{part.id}/")
    assert response.status_code == 200

    response = auth_client.patch(
        f"/api/parts/{part.id}/",
        data={"brand": "Bosch"},
        content_type="application/json",
    )
    assert response.status_code == 200
