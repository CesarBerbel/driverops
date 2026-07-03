import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    # See apps/accounts/tests/conftest.py for why this is needed -- DRF's
    # login throttle state lives in Django's cache, which isn't reset
    # between tests the way the DB is.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )


@pytest.fixture
def auth_client(client, user):
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client
