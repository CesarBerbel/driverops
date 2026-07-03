import pytest

from apps.categories.models import Category

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/categories/")
    assert response.status_code == 401


def test_create_requires_authentication(client):
    response = client.post(
        "/api/categories/", data={"name": "Fuel"}, content_type="application/json"
    )
    assert response.status_code == 401


def test_create_with_valid_name(auth_client):
    response = auth_client.post(
        "/api/categories/", data={"name": "Fuel"}, content_type="application/json"
    )
    assert response.status_code == 201
    assert response.data["name"] == "Fuel"
    assert response.data["is_active"] is True


def test_create_without_name_is_rejected(auth_client):
    response = auth_client.post(
        "/api/categories/", data={}, content_type="application/json"
    )
    assert response.status_code == 400


def test_create_rejects_duplicate_name_case_insensitive(auth_client):
    Category.objects.create(name="Fuel")

    response = auth_client.post(
        "/api/categories/", data={"name": "FUEL"}, content_type="application/json"
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_create_allows_name_matching_an_inactive_category(auth_client):
    Category.objects.create(name="Fuel", is_active=False)

    response = auth_client.post(
        "/api/categories/", data={"name": "Fuel"}, content_type="application/json"
    )
    assert response.status_code == 201


def test_list_defaults_to_active_only(auth_client):
    Category.objects.create(name="Active One", is_active=True)
    Category.objects.create(name="Inactive One", is_active=False)

    response = auth_client.get("/api/categories/")
    names = [item["name"] for item in response.data]
    assert names == ["Active One"]


def test_list_inactive_filter(auth_client):
    Category.objects.create(name="Active One", is_active=True)
    Category.objects.create(name="Inactive One", is_active=False)

    response = auth_client.get("/api/categories/?status=inactive")
    names = [item["name"] for item in response.data]
    assert names == ["Inactive One"]


def test_list_all_filter(auth_client):
    Category.objects.create(name="Active One", is_active=True)
    Category.objects.create(name="Inactive One", is_active=False)

    response = auth_client.get("/api/categories/?status=all")
    names = sorted(item["name"] for item in response.data)
    assert names == ["Active One", "Inactive One"]


def test_update_name_and_description(auth_client):
    category = Category.objects.create(name="Fuel", description="Old")

    response = auth_client.patch(
        f"/api/categories/{category.id}/",
        data={"description": "New"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["description"] == "New"


def test_delete_soft_deletes_instead_of_removing_row(auth_client):
    category = Category.objects.create(name="Fuel")

    response = auth_client.delete(f"/api/categories/{category.id}/")
    assert response.status_code == 204

    category.refresh_from_db()
    assert category.is_active is False
    assert Category.objects.filter(pk=category.pk).exists()

    list_response = auth_client.get("/api/categories/")
    assert list_response.data == []


def test_reactivate_restores_active_flag(auth_client):
    category = Category.objects.create(name="Fuel", is_active=False)

    response = auth_client.post(f"/api/categories/{category.id}/reactivate/")
    assert response.status_code == 200
    assert response.data["is_active"] is True

    category.refresh_from_db()
    assert category.is_active is True


def test_reactivate_blocked_when_active_duplicate_exists(auth_client):
    Category.objects.create(name="Fuel", is_active=True)
    inactive = Category.objects.create(name="Fuel", is_active=False)

    response = auth_client.post(f"/api/categories/{inactive.id}/reactivate/")
    assert response.status_code == 400

    inactive.refresh_from_db()
    assert inactive.is_active is False
