import pytest

from apps.customers.models import Customer
from apps.vehicles.models import Vehicle

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/vehicles/")
    assert response.status_code == 401


def test_create_requires_authentication(client, customer):
    response = client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "ABC1234"},
        content_type="application/json",
    )
    assert response.status_code == 401


def test_create_requires_customer(auth_client):
    response = auth_client.post(
        "/api/vehicles/",
        data={"license_plate": "ABC1234"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "customer" in response.data


def test_create_requires_license_plate(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "license_plate" in response.data


def test_create_with_only_customer_and_plate(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "ABC1234"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["license_plate"] == "ABC1234"
    assert response.data["customer_name"] == "Vehicle Owner"
    assert response.data["brand"] == ""
    assert response.data["manufacture_year"] is None


@pytest.mark.parametrize(
    "raw_plate,expected",
    [
        ("abc-1234", "ABC1234"),
        ("abc 1234", "ABC1234"),
        ("ABC1234", "ABC1234"),
        ("abc1d23", "ABC1D23"),
        ("ABC-1D23", "ABC1D23"),
    ],
)
def test_create_normalizes_plate(auth_client, customer, raw_plate, expected):
    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": raw_plate},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["license_plate"] == expected


def test_create_rejects_invalid_plate_format(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "XYZ99"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "license_plate" in response.data


def test_create_rejects_duplicate_active_plate(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="ABC1234")

    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "ABC1234"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "license_plate" in response.data


def test_create_allows_plate_of_a_soft_deleted_vehicle(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="ABC1234", is_active=False)

    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "ABC1234"},
        content_type="application/json",
    )
    assert response.status_code == 201


def test_create_rejects_model_year_before_manufacture_year(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={
            "customer": customer.id,
            "license_plate": "ABC1234",
            "manufacture_year": 2020,
            "model_year": 2019,
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "model_year" in response.data


def test_create_allows_equal_manufacture_and_model_year(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={
            "customer": customer.id,
            "license_plate": "ABC1234",
            "manufacture_year": 2020,
            "model_year": 2020,
        },
        content_type="application/json",
    )
    assert response.status_code == 201


def test_create_rejects_year_out_of_range(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={
            "customer": customer.id,
            "license_plate": "ABC1234",
            "manufacture_year": 1800,
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "manufacture_year" in response.data


def test_create_rejects_negative_mileage(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={"customer": customer.id, "license_plate": "ABC1234", "mileage": -1},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "mileage" in response.data


def test_create_normalizes_chassis_and_renavam(auth_client, customer):
    response = auth_client.post(
        "/api/vehicles/",
        data={
            "customer": customer.id,
            "license_plate": "ABC1234",
            "chassis": " 9bwzzz377vt004251 ",
            "renavam": "12345678901 ",
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["chassis"] == "9BWZZZ377VT004251"
    assert response.data["renavam"] == "12345678901"


def test_list_default_active_only(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", is_active=True)
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", is_active=False)

    response = auth_client.get("/api/vehicles/")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_list_inactive_filter(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", is_active=True)
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", is_active=False)

    response = auth_client.get("/api/vehicles/?status=inactive")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["BBB2222"]


def test_list_all_filter(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", is_active=True)
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", is_active=False)

    response = auth_client.get("/api/vehicles/?status=all")
    plates = sorted(item["license_plate"] for item in response.data)
    assert plates == ["AAA1111", "BBB2222"]


def test_search_by_plate(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111")
    Vehicle.objects.create(customer=customer, license_plate="BBB2222")

    response = auth_client.get("/api/vehicles/?search=AAA")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_search_by_customer_name(auth_client):
    alice = Customer.objects.create(name="Alice Wonderland")
    bob = Customer.objects.create(name="Bob Builder")
    Vehicle.objects.create(customer=alice, license_plate="AAA1111")
    Vehicle.objects.create(customer=bob, license_plate="BBB2222")

    response = auth_client.get("/api/vehicles/?search=alice")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_search_by_brand(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", brand="Toyota")
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", brand="Honda")

    response = auth_client.get("/api/vehicles/?search=toyota")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_search_by_model(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", model="Corolla")
    Vehicle.objects.create(customer=customer, license_plate="BBB2222", model="Civic")

    response = auth_client.get("/api/vehicles/?search=corolla")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_filter_by_customer(auth_client):
    alice = Customer.objects.create(name="Alice Wonderland")
    bob = Customer.objects.create(name="Bob Builder")
    Vehicle.objects.create(customer=alice, license_plate="AAA1111")
    Vehicle.objects.create(customer=bob, license_plate="BBB2222")

    response = auth_client.get(f"/api/vehicles/?customer={alice.id}")
    plates = [item["license_plate"] for item in response.data]
    assert plates == ["AAA1111"]


def test_update_changes_fields(auth_client, customer):
    vehicle = Vehicle.objects.create(customer=customer, license_plate="AAA1111")

    response = auth_client.patch(
        f"/api/vehicles/{vehicle.id}/",
        data={"brand": "Toyota", "model": "Corolla"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["brand"] == "Toyota"
    assert response.data["model"] == "Corolla"


def test_delete_soft_deletes_instead_of_removing_row(auth_client, customer):
    vehicle = Vehicle.objects.create(customer=customer, license_plate="AAA1111")

    response = auth_client.delete(f"/api/vehicles/{vehicle.id}/")
    assert response.status_code == 204

    vehicle.refresh_from_db()
    assert vehicle.is_active is False
    assert Vehicle.objects.filter(pk=vehicle.pk).exists()

    list_response = auth_client.get("/api/vehicles/")
    assert list_response.data == []


def test_reactivate_restores_active_flag(auth_client, customer):
    vehicle = Vehicle.objects.create(
        customer=customer, license_plate="AAA1111", is_active=False
    )

    response = auth_client.post(f"/api/vehicles/{vehicle.id}/reactivate/")
    assert response.status_code == 200
    assert response.data["license_plate"] == "AAA1111"

    vehicle.refresh_from_db()
    assert vehicle.is_active is True


def test_reactivate_blocked_when_active_plate_conflict_exists(auth_client, customer):
    Vehicle.objects.create(customer=customer, license_plate="AAA1111", is_active=True)
    inactive = Vehicle.objects.create(
        customer=customer, license_plate="AAA1111", is_active=False
    )

    response = auth_client.post(f"/api/vehicles/{inactive.id}/reactivate/")
    assert response.status_code == 400

    inactive.refresh_from_db()
    assert inactive.is_active is False
