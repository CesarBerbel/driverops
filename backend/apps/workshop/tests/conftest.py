import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email="admin@example.com", password="StrongPass123", full_name="Admin"
    )


@pytest.fixture
def auth_client(client, user):
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def super_client(client, superuser):
    client.post(
        "/api/auth/login/",
        data={"email": superuser.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client
