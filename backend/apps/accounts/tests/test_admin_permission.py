import pytest

pytestmark = pytest.mark.django_db


def test_admin_ping_unauthenticated_returns_401(client):
    response = client.get("/api/admin/ping/")
    assert response.status_code == 401


def test_admin_ping_regular_user_returns_403(auth_client):
    response = auth_client.get("/api/admin/ping/")
    assert response.status_code == 403


def test_admin_ping_superuser_returns_200(superuser_client):
    response = superuser_client.get("/api/admin/ping/")
    assert response.status_code == 200
