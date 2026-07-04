import pytest

from ..models import Supplier

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/suppliers/")
    assert response.status_code == 401


def test_create_requires_authentication(client):
    response = client.post(
        "/api/suppliers/",
        data={"name": "Fornecedor Ltda"},
        content_type="application/json",
    )
    assert response.status_code == 401


def test_create_with_only_name_defaults_to_company(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Fornecedor Ltda"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Fornecedor Ltda"
    assert response.data["supplier_type"] == "company"


def test_create_rejects_empty_name(auth_client):
    response = auth_client.post(
        "/api/suppliers/", data={"name": "   "}, content_type="application/json"
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_document_length_validated_for_company(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste", "document": "12345678900"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "document" in response.data


def test_document_length_validated_for_individual(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={
            "name": "Teste",
            "supplier_type": "individual",
            "document": "12345678000100",
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "document" in response.data


def test_document_normalizes_to_digits_only(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste PJ", "document": "12.345.678/0001-00"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["document"] == "12345678000100"


def test_phone_and_whatsapp_normalize_and_validate(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={
            "name": "Teste",
            "phone": "(11) 3265-4321",
            "whatsapp": "(11) 98765-4321",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["phone"] == "1132654321"
    assert response.data["whatsapp"] == "11987654321"


def test_phone_rejects_wrong_length(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste", "phone": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "phone" in response.data


def test_zip_code_normalizes_and_validates(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste", "zip_code": "01310-100"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["zip_code"] == "01310100"


def test_zip_code_rejects_wrong_length(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste", "zip_code": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "zip_code" in response.data


def test_state_is_uppercased_and_truncated(auth_client):
    response = auth_client.post(
        "/api/suppliers/",
        data={"name": "Teste", "state": "sp"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["state"] == "SP"


def test_list_defaults_to_active_only(auth_client):
    Supplier.objects.create(name="Ativo", is_active=True)
    Supplier.objects.create(name="Inativo", is_active=False)

    response = auth_client.get("/api/suppliers/")
    names = [item["name"] for item in response.data]
    assert names == ["Ativo"]


def test_list_inactive_filter(auth_client):
    Supplier.objects.create(name="Ativo", is_active=True)
    Supplier.objects.create(name="Inativo", is_active=False)

    response = auth_client.get("/api/suppliers/?status=inactive")
    names = [item["name"] for item in response.data]
    assert names == ["Inativo"]


def test_list_all_filter(auth_client):
    Supplier.objects.create(name="Ativo", is_active=True)
    Supplier.objects.create(name="Inativo", is_active=False)

    response = auth_client.get("/api/suppliers/?status=all")
    names = sorted(item["name"] for item in response.data)
    assert names == ["Ativo", "Inativo"]


def test_search_by_name(auth_client):
    Supplier.objects.create(name="Auto Peças Silva")
    Supplier.objects.create(name="Distribuidora Rocha")

    response = auth_client.get("/api/suppliers/?search=Silva")
    names = [item["name"] for item in response.data]
    assert names == ["Auto Peças Silva"]


def test_search_by_trade_name(auth_client):
    Supplier.objects.create(name="Comercial ABC Ltda", trade_name="Peças Rápidas")
    Supplier.objects.create(name="Distribuidora Rocha")

    response = auth_client.get("/api/suppliers/?search=Rápidas")
    names = [item["name"] for item in response.data]
    assert names == ["Comercial ABC Ltda"]


def test_search_by_document(auth_client):
    Supplier.objects.create(name="Comercial ABC Ltda", document="12345678000100")
    Supplier.objects.create(name="Distribuidora Rocha", document="98765432000111")

    response = auth_client.get("/api/suppliers/?search=12345678")
    names = [item["name"] for item in response.data]
    assert names == ["Comercial ABC Ltda"]


def test_destroy_soft_deletes_instead_of_removing_row(auth_client):
    supplier = Supplier.objects.create(name="Fornecedor Ltda")

    response = auth_client.delete(f"/api/suppliers/{supplier.id}/")
    assert response.status_code == 204

    supplier.refresh_from_db()
    assert supplier.is_active is False
    assert Supplier.objects.filter(pk=supplier.pk).exists()

    list_response = auth_client.get("/api/suppliers/")
    assert list_response.data == []


def test_reactivate_sets_is_active_true(auth_client):
    supplier = Supplier.objects.create(name="Fornecedor Ltda", is_active=False)

    response = auth_client.post(f"/api/suppliers/{supplier.id}/reactivate/")
    assert response.status_code == 200

    supplier.refresh_from_db()
    assert supplier.is_active is True


def test_detail_routes_ignore_status_filter(auth_client):
    supplier = Supplier.objects.create(name="Fornecedor Ltda", is_active=False)

    response = auth_client.get(f"/api/suppliers/{supplier.id}/")
    assert response.status_code == 200

    response = auth_client.patch(
        f"/api/suppliers/{supplier.id}/",
        data={"trade_name": "Novo Nome"},
        content_type="application/json",
    )
    assert response.status_code == 200
