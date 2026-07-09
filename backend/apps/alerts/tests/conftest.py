import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from apps.accounts.models import Role
from apps.alerts.models import Notification, NotifModule, NotifPriority, NotifType

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _login(client, email, password="StrongPass123"):
    client.post(
        "/api/auth/login/",
        data={"email": email, "password": password},
        content_type="application/json",
    )
    return client


def make_user(email, role_key=None, *, is_superuser=False, password="StrongPass123"):
    if is_superuser:
        u = User.objects.create_superuser(
            email=email, password=password, full_name="Root"
        )
    else:
        u = User.objects.create_user(
            email=email, password=password, full_name=email.split("@")[0]
        )
    if role_key:
        u.role = Role.objects.filter(key=role_key).first()
        u.save(update_fields=["role"])
    return u


@pytest.fixture
def atendente(db):
    return make_user("aten@example.com", "atendente")


@pytest.fixture
def atendente_client(atendente):
    return _login(Client(), atendente.email)


@pytest.fixture
def financeiro(db):
    return make_user("fin@example.com", "financeiro")


@pytest.fixture
def financeiro_client(financeiro):
    return _login(Client(), financeiro.email)


@pytest.fixture
def estoque(db):
    return make_user("est@example.com", "estoque")


@pytest.fixture
def super_user(db):
    return make_user("root@example.com", is_superuser=True)


@pytest.fixture
def super_client(super_user):
    return _login(Client(), super_user.email)


@pytest.fixture
def roleless_client(db):
    make_user("nobody@example.com")  # sem papel -> sem alerts.view
    return _login(Client(), "nobody@example.com")


def make_notification(user, **over):
    data = dict(
        recipient=user,
        notif_type=NotifType.SITE_LEAD_CREATED,
        module=NotifModule.LEADS,
        title="Novo pedido vindo do site",
        message="Alguém deixou contato.",
        priority=NotifPriority.IMPORTANT,
    )
    data.update(over)
    return Notification.objects.create(**data)
