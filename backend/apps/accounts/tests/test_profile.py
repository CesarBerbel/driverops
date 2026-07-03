import pytest

pytestmark = pytest.mark.django_db


def test_patch_me_updates_full_name(auth_client):
    response = auth_client.patch(
        "/api/users/me/",
        data={"full_name": "New Name"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.data["full_name"] == "New Name"


def test_change_password_with_wrong_current_password_returns_400(auth_client):
    response = auth_client.post(
        "/api/users/change-password/",
        data={
            "current_password": "not-the-real-password",
            "new_password": "BrandNewPass456",
            "new_password_confirm": "BrandNewPass456",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_change_password_with_mismatched_confirm_returns_400(auth_client):
    response = auth_client.post(
        "/api/users/change-password/",
        data={
            "current_password": "StrongPass123",
            "new_password": "BrandNewPass456",
            "new_password_confirm": "SomethingElse789",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_change_password_with_weak_new_password_returns_400(auth_client):
    response = auth_client.post(
        "/api/users/change-password/",
        data={
            "current_password": "StrongPass123",
            "new_password": "123",
            "new_password_confirm": "123",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_change_password_success_allows_login_with_new_password(auth_client, user):
    response = auth_client.post(
        "/api/users/change-password/",
        data={
            "current_password": "StrongPass123",
            "new_password": "BrandNewPass456",
            "new_password_confirm": "BrandNewPass456",
        },
        content_type="application/json",
    )
    assert response.status_code == 204

    old_login = auth_client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    assert old_login.status_code == 401

    new_login = auth_client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "BrandNewPass456"},
        content_type="application/json",
    )
    assert new_login.status_code == 200
