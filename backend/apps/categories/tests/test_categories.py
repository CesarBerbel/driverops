import pytest

from apps.categories.models import Category

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(client):
    response = client.get("/api/categories/")
    assert response.status_code == 401


def test_create_requires_authentication(client):
    response = client.post(
        "/api/categories/",
        data={"name": "Fuel", "category_type": "client"},
        content_type="application/json",
    )
    assert response.status_code == 401


def test_create_with_valid_name(auth_client):
    response = auth_client.post(
        "/api/categories/",
        data={"name": "Fuel", "category_type": "client"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Fuel"
    assert response.data["category_type"] == "client"
    assert response.data["is_active"] is True


def test_create_without_name_is_rejected(auth_client):
    response = auth_client.post(
        "/api/categories/",
        data={"category_type": "client"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_create_without_category_type_is_rejected(auth_client):
    response = auth_client.post(
        "/api/categories/", data={"name": "Fuel"}, content_type="application/json"
    )
    assert response.status_code == 400
    assert "category_type" in response.data


def test_create_rejects_invalid_category_type(auth_client):
    response = auth_client.post(
        "/api/categories/",
        data={"name": "Fuel", "category_type": "bogus"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category_type" in response.data


def test_create_rejects_duplicate_name_case_insensitive(auth_client):
    Category.objects.create(name="Fuel", category_type="client")

    response = auth_client.post(
        "/api/categories/",
        data={"name": "FUEL", "category_type": "client"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_create_allows_name_matching_an_inactive_category(auth_client):
    Category.objects.create(name="Fuel", category_type="client", is_active=False)

    response = auth_client.post(
        "/api/categories/",
        data={"name": "Fuel", "category_type": "client"},
        content_type="application/json",
    )
    assert response.status_code == 201


def test_same_name_allowed_across_different_category_types(auth_client):
    Category.objects.create(name="Fuel", category_type="client")

    response = auth_client.post(
        "/api/categories/",
        data={"name": "Fuel", "category_type": "part"},
        content_type="application/json",
    )
    assert response.status_code == 201


def test_duplicate_name_within_same_type_is_still_rejected(auth_client):
    Category.objects.create(name="Fuel", category_type="part")

    response = auth_client.post(
        "/api/categories/",
        data={"name": "FUEL", "category_type": "part"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.data


def test_list_defaults_to_active_only(auth_client):
    Category.objects.create(name="Active One", category_type="client", is_active=True)
    Category.objects.create(
        name="Inactive One", category_type="client", is_active=False
    )

    response = auth_client.get("/api/categories/")
    names = [item["name"] for item in response.data]
    assert names == ["Active One"]


def test_list_inactive_filter(auth_client):
    Category.objects.create(name="Active One", category_type="client", is_active=True)
    Category.objects.create(
        name="Inactive One", category_type="client", is_active=False
    )

    response = auth_client.get("/api/categories/?status=inactive")
    names = [item["name"] for item in response.data]
    assert names == ["Inactive One"]


def test_list_all_filter(auth_client):
    Category.objects.create(name="Active One", category_type="client", is_active=True)
    Category.objects.create(
        name="Inactive One", category_type="client", is_active=False
    )

    response = auth_client.get("/api/categories/?status=all")
    names = sorted(item["name"] for item in response.data)
    assert names == ["Active One", "Inactive One"]


def test_list_filtered_by_category_type(auth_client):
    Category.objects.create(name="Client Cat", category_type="client")
    Category.objects.create(name="Part Cat", category_type="part")

    response = auth_client.get("/api/categories/?category_type=part")
    names = [item["name"] for item in response.data]
    assert names == ["Part Cat"]


def test_list_category_type_and_status_combine(auth_client):
    Category.objects.create(name="Active Part", category_type="part", is_active=True)
    Category.objects.create(name="Inactive Part", category_type="part", is_active=False)
    Category.objects.create(
        name="Active Client", category_type="client", is_active=True
    )

    response = auth_client.get("/api/categories/?category_type=part&status=inactive")
    names = [item["name"] for item in response.data]
    assert names == ["Inactive Part"]


def test_update_name_and_description(auth_client):
    category = Category.objects.create(
        name="Fuel", category_type="client", description="Old"
    )

    response = auth_client.patch(
        f"/api/categories/{category.id}/",
        data={"description": "New"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["description"] == "New"


def test_update_notes(auth_client):
    category = Category.objects.create(name="Fuel", category_type="client")

    response = auth_client.patch(
        f"/api/categories/{category.id}/",
        data={"notes": "Some notes"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["notes"] == "Some notes"


def test_update_cannot_change_category_type(auth_client):
    category = Category.objects.create(name="Fuel", category_type="part")

    response = auth_client.patch(
        f"/api/categories/{category.id}/",
        data={"category_type": "service"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "category_type" in response.data

    category.refresh_from_db()
    assert category.category_type == "part"


def test_delete_soft_deletes_instead_of_removing_row(auth_client):
    category = Category.objects.create(name="Fuel", category_type="client")

    response = auth_client.delete(f"/api/categories/{category.id}/")
    assert response.status_code == 204

    category.refresh_from_db()
    assert category.is_active is False
    assert Category.objects.filter(pk=category.pk).exists()

    list_response = auth_client.get("/api/categories/")
    assert list_response.data == []


def test_reactivate_restores_active_flag(auth_client):
    category = Category.objects.create(
        name="Fuel", category_type="client", is_active=False
    )

    response = auth_client.post(f"/api/categories/{category.id}/reactivate/")
    assert response.status_code == 200
    assert response.data["is_active"] is True

    category.refresh_from_db()
    assert category.is_active is True


def test_reactivate_blocked_when_active_duplicate_exists(auth_client):
    Category.objects.create(name="Fuel", category_type="client", is_active=True)
    inactive = Category.objects.create(
        name="Fuel", category_type="client", is_active=False
    )

    response = auth_client.post(f"/api/categories/{inactive.id}/reactivate/")
    assert response.status_code == 400

    inactive.refresh_from_db()
    assert inactive.is_active is False


def test_reactivate_conflict_scoped_by_category_type(auth_client):
    Category.objects.create(name="Fuel", category_type="client", is_active=True)
    inactive_part = Category.objects.create(
        name="Fuel", category_type="part", is_active=False
    )

    response = auth_client.post(f"/api/categories/{inactive_part.id}/reactivate/")
    assert response.status_code == 200

    inactive_part.refresh_from_db()
    assert inactive_part.is_active is True
