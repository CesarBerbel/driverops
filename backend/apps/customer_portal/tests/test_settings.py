"""Testes do endpoint interno de configuração do Portal do Cliente."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.accounts.models import Permission, UserPermission
from apps.customer_portal.models import CustomerPortalSettings

User = get_user_model()
pytestmark = pytest.mark.django_db

URL = "/api/settings/customer-portal/"


def make_user(email, codes):
    user = User.objects.create_user(
        email=email, password="StrongPass123", full_name=email.split("@")[0]
    )
    for code in codes:
        perm = Permission.objects.get(codename=code)
        UserPermission.objects.create(
            user=user, permission=perm, grant_type=UserPermission.GrantType.GRANT
        )
    return user


def login(user):
    client = Client()
    client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "StrongPass123"},
        content_type="application/json",
    )
    return client


def test_get_returns_settings_with_view_permission():
    client = login(make_user("viewer@example.com", ["settings.view"]))
    r = client.get(URL)
    assert r.status_code == 200
    assert "enabled" in r.json()
    assert "allow_messages" in r.json()


def test_get_denied_without_permission():
    client = login(make_user("nobody@example.com", []))
    assert client.get(URL).status_code == 403


def test_patch_requires_edit_permission():
    client = login(make_user("viewer2@example.com", ["settings.view"]))
    r = client.patch(URL, data={"enabled": False}, content_type="application/json")
    assert r.status_code == 403


def test_patch_updates_settings():
    client = login(make_user("editor@example.com", ["settings.view", "settings.edit"]))
    r = client.patch(
        URL,
        data={"enabled": False, "link_validity_hours": 12, "allow_messages": False},
        content_type="application/json",
    )
    assert r.status_code == 200
    conf = CustomerPortalSettings.get_solo()
    assert conf.enabled is False
    assert conf.link_validity_hours == 12
    assert conf.allow_messages is False


def test_patch_validates_link_validity_bounds():
    client = login(make_user("editor2@example.com", ["settings.view", "settings.edit"]))
    r = client.patch(
        URL, data={"link_validity_hours": 999}, content_type="application/json"
    )
    assert r.status_code == 400
