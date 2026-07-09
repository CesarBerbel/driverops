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


def test_create_normalizes_masked_phone_whatsapp_document_zip(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={
            "name": "Jane Corp",
            "customer_type": "company",
            "phone": "(11) 98765-4321",
            "whatsapp": "(11) 91234-5678",
            "document": "12.345.678/0001-95",
            "zip_code": "01310-100",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["phone"] == "11987654321"
    assert response.data["whatsapp"] == "11912345678"
    assert response.data["document"] == "12345678000195"
    assert response.data["zip_code"] == "01310100"


def test_create_rejects_invalid_whatsapp_length(auth_client):
    response = auth_client.post(
        "/api/customers/",
        data={"name": "Bad WhatsApp", "whatsapp": "123"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "whatsapp" in response.data


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


def test_create_rejects_duplicate_phone(auth_client):
    Customer.objects.create(name="Primeiro", phone="11988887777", whatsapp="11988887777")

    response = auth_client.post(
        "/api/customers/",
        data={"name": "Segundo", "phone": "(11) 98888-7777"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "phone" in response.data


def test_create_rejects_phone_already_used_as_whatsapp(auth_client):
    # O número já existe no WhatsApp de outro cliente -- mesmo espaço de números.
    Customer.objects.create(name="Primeiro", whatsapp="11988887777")

    response = auth_client.post(
        "/api/customers/",
        data={"name": "Segundo", "phone": "11988887777"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "phone" in response.data


def test_create_rejects_duplicate_whatsapp(auth_client):
    Customer.objects.create(name="Primeiro", whatsapp="11988887777")

    response = auth_client.post(
        "/api/customers/",
        data={"name": "Segundo", "whatsapp": "(11) 98888-7777"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "whatsapp" in response.data


def test_create_rejects_whatsapp_already_used_as_phone(auth_client):
    # O número já existe no telefone de outro cliente -> bloqueia também no WhatsApp.
    Customer.objects.create(name="Primeiro", phone="11988887777")

    response = auth_client.post(
        "/api/customers/",
        data={"name": "Segundo", "whatsapp": "11988887777"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "whatsapp" in response.data


def test_create_rejects_duplicate_document(auth_client):
    Customer.objects.create(name="Primeiro", document="12345678900")

    response = auth_client.post(
        "/api/customers/",
        data={"name": "Segundo", "document": "123.456.789-00"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "document" in response.data


def test_create_allows_empty_phone_and_document_for_many_customers(auth_client):
    Customer.objects.create(name="Sem contato")

    response = auth_client.post(
        "/api/customers/", data={"name": "Outro sem contato"}, content_type="application/json"
    )
    assert response.status_code == 201


def test_update_keeps_own_phone_without_conflict(auth_client):
    customer = Customer.objects.create(name="Dono", phone="11988887777", whatsapp="11988887777")

    response = auth_client.patch(
        f"/api/customers/{customer.id}/",
        data={"name": "Dono Renomeado"},
        content_type="application/json",
    )
    assert response.status_code == 200


def test_delete_soft_deletes_and_reactivate_restores(auth_client):
    customer = Customer.objects.create(name="Someone")

    # DELETE = soft delete: registro preservado, apenas inativado.
    response = auth_client.delete(f"/api/customers/{customer.id}/")
    assert response.status_code == 204
    customer.refresh_from_db()
    assert customer.is_active is False
    assert Customer.objects.filter(pk=customer.pk).exists()

    # Inativos somem da listagem padrão, aparecem com status=inactive.
    active_ids = [c["id"] for c in auth_client.get("/api/customers/").data]
    assert customer.id not in active_ids
    inactive_ids = [c["id"] for c in auth_client.get("/api/customers/?status=inactive").data]
    assert customer.id in inactive_ids

    # Reativar restaura.
    reactivate = auth_client.post(f"/api/customers/{customer.id}/reactivate/")
    assert reactivate.status_code == 200
    customer.refresh_from_db()
    assert customer.is_active is True


def test_db_unique_constraint_blocks_duplicate_phone(auth_client):
    from django.db import IntegrityError, transaction

    Customer.objects.create(name="Primeiro", phone="11955554444")
    # Rede de segurança no banco (bypassa a validação de aplicação).
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Customer.objects.create(name="Segundo", phone="11955554444")


def test_list_includes_vehicle_count_of_active_vehicles_only(auth_client):
    from apps.vehicles.models import Vehicle

    customer = Customer.objects.create(name="Vehicle Owner")
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", is_active=True)
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", is_active=True)
    Vehicle.objects.create(customer=customer, license_plate="CCC3333", is_active=False)

    other = Customer.objects.create(name="No Vehicles")

    response = auth_client.get("/api/customers/")
    by_id = {item["id"]: item["vehicle_count"] for item in response.data}
    assert by_id[customer.id] == 2
    assert by_id[other.id] == 0
