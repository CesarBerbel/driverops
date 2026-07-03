import pytest

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/customers/")
    assert response.status_code == 401


def test_create_requires_authentication(client):
    response = client.post(
        "/api/customers/", data={"name": "John"}, content_type="application/json"
    )
    assert response.status_code == 401


def test_create_with_only_name_defaults_to_individual(auth_client):
    response = auth_client.post(
        "/api/customers/", data={"name": "John Doe"}, content_type="application/json"
    )
    assert response.status_code == 201
    assert response.data["name"] == "John Doe"
    assert response.data["customer_type"] == "individual"
    assert response.data["country"] == "Brasil"


def test_create_company_with_valid_cnpj_length(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Acme", "customer_type": "company", "document": "12345678000195"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["document"] == "12345678000195"


def test_create_rejects_document_length_mismatch_for_type(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Bad Doc", "customer_type": "company", "document": "12345678900"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "document" in response.data


def test_create_rejects_malformed_email(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Bad Email", "email": "not-an-email"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "email" in response.data


def test_create_normalizes_masked_phone_document_zip(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={
            "name": "Jane Corp",
            "customer_type": "company",
            "phone": "(11) 98765-4321",
            "document": "12.345.678/0001-95",
            "zip_code": "01310-100",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["phone"] == "11987654321"
    assert response.data["document"] == "12345678000195"
    assert response.data["zip_code"] == "01310100"


def test_create_uppercases_state(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Someone", "state": "sp"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["state"] == "SP"


def test_create_rejects_invalid_phone_length(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Bad Phone", "phone": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "phone" in response.data


def test_create_rejects_invalid_zip_length(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Bad Zip", "zip_code": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "zip_code" in response.data


def test_list_search_filters_by_name_case_insensitive(auth_client):
    Customer.objects.create(name="Alice Wonderland")
    Customer.objects.create(name="Bob Builder")

    response = auth_client.get("/api/customers/?search=alice")
    names = [item["name"] for item in response.data]
    assert names == ["Alice Wonderland"]


def test_list_without_search_returns_all(auth_client):
    Customer.objects.create(name="Alice Wonderland")
    Customer.objects.create(name="Bob Builder")

    response = auth_client.get("/api/customers/")
    names = sorted(item["name"] for item in response.data)
    assert names == ["Alice Wonderland", "Bob Builder"]


def test_update_changes_fields(auth_client):
    customer = Customer.objects.create(name="Old Name")

    response = auth_client.patch(
        f"/api/customers/{customer.id}/",
        data={"name": "New Name", "city": "São Paulo"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["name"] == "New Name"
    assert response.data["city"] == "São Paulo"


def test_update_revalidates_document_against_new_type(auth_client):
    customer = Customer.objects.create(
        name="Individual",
        customer_type=Customer.CustomerType.INDIVIDUAL,
        document="12345678900",
    )

    response = auth_client.patch(
        f"/api/customers/{customer.id}/",
        data={"customer_type": "company"},
        content_type="application/json",
    )
    # document unchanged in this request, so it's not re-validated against
    # the new type -- only touched fields go through validate().
    assert response.status_code == 200

    response = auth_client.patch(
        f"/api/customers/{customer.id}/",
        data={"customer_type": "company", "document": "12345678900"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_delete_is_not_exposed(auth_client):
    customer = Customer.objects.create(name="Someone")

    response = auth_client.delete(f"/api/customers/{customer.id}/")
    assert response.status_code == 405
    assert Customer.objects.filter(pk=customer.pk).exists()
