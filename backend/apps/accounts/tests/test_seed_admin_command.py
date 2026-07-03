import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

User = get_user_model()

pytestmark = pytest.mark.django_db


def _set_env(
    monkeypatch, email="admin@example.com", password="FirstPass123", name="Admin"
):
    monkeypatch.setenv("DJANGO_SUPERUSER_EMAIL", email)
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", password)
    monkeypatch.setenv("DJANGO_SUPERUSER_NAME", name)


def test_creates_superuser_with_flags_set(monkeypatch):
    _set_env(monkeypatch)

    call_command("seed_admin")

    user = User.objects.get(email="admin@example.com")
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.check_password("FirstPass123")


def test_rerunning_does_not_create_duplicate_and_updates_password(monkeypatch):
    _set_env(monkeypatch, password="FirstPass123")
    call_command("seed_admin")

    _set_env(monkeypatch, password="SecondPass456")
    call_command("seed_admin")

    assert User.objects.filter(email="admin@example.com").count() == 1
    user = User.objects.get(email="admin@example.com")
    assert user.check_password("SecondPass456")
    assert not user.check_password("FirstPass123")


def test_missing_env_vars_raises_command_error(monkeypatch):
    monkeypatch.delenv("DJANGO_SUPERUSER_EMAIL", raising=False)
    monkeypatch.delenv("DJANGO_SUPERUSER_PASSWORD", raising=False)

    with pytest.raises(CommandError):
        call_command("seed_admin")
