import pytest

pytestmark = pytest.mark.django_db


def test_login_success_sets_cookies_and_returns_user(client, user):
    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.data["user"]["email"] == user.email
    assert "access_token" in response.cookies
    assert response.cookies["access_token"]["httponly"]
    assert "refresh_token" in response.cookies


def test_login_wrong_password_returns_401(client, user):
    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "wrong-password"},
        content_type="application/json",
    )

    assert response.status_code == 401


def test_me_requires_authentication(client):
    response = client.get("/api/users/me/")
    assert response.status_code == 401


def test_me_returns_current_user_when_authenticated(auth_client, user):
    response = auth_client.get("/api/users/me/")
    assert response.status_code == 200
    assert response.data["email"] == user.email


def test_refresh_with_valid_cookie_issues_new_access_cookie(auth_client):
    old_access = auth_client.cookies["access_token"].value

    response = auth_client.post("/api/auth/refresh/")

    assert response.status_code == 204
    assert response.cookies["access_token"].value != old_access


def test_refresh_without_cookie_returns_401(client):
    response = client.post("/api/auth/refresh/")
    assert response.status_code == 401


def test_logout_clears_cookies_and_blacklists_refresh(auth_client):
    response = auth_client.post("/api/auth/logout/")
    assert response.status_code == 204
    assert response.cookies["access_token"].value == ""
    assert response.cookies["refresh_token"].value == ""

    me_response = auth_client.get("/api/users/me/")
    assert me_response.status_code == 401


def test_login_is_throttled_after_repeated_failures(client, user):
    # Matches the "login": "5/min" DEFAULT_THROTTLE_RATES configured in settings/base.py.
    for _ in range(5):
        client.post(
            "/api/auth/login/",
            data={"email": user.email, "password": "wrong-password"},
            content_type="application/json",
        )

    response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "wrong-password"},
        content_type="application/json",
    )
    assert response.status_code == 429
