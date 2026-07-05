import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from apps.categories.models import Category
from apps.suppliers.models import Supplier

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    from apps.accounts.models import Role

    u = User.objects.create_user(
        email="user@example.com", password="StrongPass123", full_name="Jane Doe"
    )
    # Perfil Administrador (semeado) -> permissões amplas dos módulos de domínio.
    u.role = Role.objects.filter(key="administrador").first()
    u.save(update_fields=["role"])
    return u


@pytest.fixture
def auth_client(client, user):
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def part_category(db):
    return Category.objects.create(category_type="part", name="Motor")


@pytest.fixture
def supplier(db):
    return Supplier.objects.create(name="Fornecedor Ltda")
