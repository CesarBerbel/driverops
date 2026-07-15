"""Login e vínculo com Google (ID token verificado do Google Identity Services).

A verificação do token (``verify_google_id_token``) é isolada com monkeypatch --
os testes cobrem a POLÍTICA: só usuários existentes entram, com vínculo
automático por e-mail verificado; nunca cria conta nova.
"""

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.google import GoogleAuthError

User = get_user_model()

pytestmark = pytest.mark.django_db

CLIENT_ID = "test-client-id.apps.googleusercontent.com"


@pytest.fixture(autouse=True)
def enable_google(settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = CLIENT_ID


def _patch_verify(monkeypatch, **claims):
    """Faz verify_google_id_token devolver os claims informados (token válido)."""
    info = {
        "sub": "g-1",
        "email": "user@example.com",
        "email_verified": True,
        "name": "",
    }
    info.update(claims)
    monkeypatch.setattr(
        "apps.accounts.views.verify_google_id_token", lambda credential: info
    )


def _google_post(client, credential="tok"):
    return client.post(
        "/api/auth/google/",
        data={"credential": credential},
        content_type="application/json",
    )


def test_login_by_linked_google_account(client, user, monkeypatch):
    user.google_sub = "g-777"
    user.save(update_fields=["google_sub"])
    _patch_verify(monkeypatch, sub="g-777", email="user@example.com")

    response = _google_post(client)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"


def test_login_auto_links_by_verified_email(client, user, monkeypatch):
    assert user.google_sub is None
    _patch_verify(
        monkeypatch, sub="g-new", email="USER@example.com", email_verified=True
    )

    response = _google_post(client)
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.google_sub == "g-new"  # vinculado automaticamente


def test_login_rejects_unknown_email_without_creating_account(client, monkeypatch):
    _patch_verify(
        monkeypatch, sub="g-x", email="ninguem@example.com", email_verified=True
    )

    response = _google_post(client)
    assert response.status_code == 403
    assert User.objects.count() == 0  # nunca cria conta nova


def test_login_rejects_unverified_email(client, user, monkeypatch):
    _patch_verify(
        monkeypatch, sub="g-x", email="user@example.com", email_verified=False
    )

    response = _google_post(client)
    assert response.status_code == 401


def test_login_rejects_invalid_token(client, monkeypatch):
    def _raise(credential):
        raise GoogleAuthError("token inválido")

    monkeypatch.setattr("apps.accounts.views.verify_google_id_token", _raise)
    response = _google_post(client)
    assert response.status_code == 401


def test_login_disabled_without_client_id(client, settings, monkeypatch):
    settings.GOOGLE_OAUTH_CLIENT_ID = ""
    response = _google_post(client)
    assert response.status_code == 503


def test_link_google_for_logged_in_user(auth_client, user, monkeypatch):
    _patch_verify(monkeypatch, sub="g-link", email="user@example.com")

    response = auth_client.post(
        "/api/users/me/link-google/",
        data={"credential": "tok"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["google_linked"] is True
    user.refresh_from_db()
    assert user.google_sub == "g-link"


def test_link_rejects_google_account_used_by_another_user(auth_client, monkeypatch):
    User.objects.create_user(
        email="other@example.com", password="StrongPass123", google_sub="g-taken"
    )
    _patch_verify(monkeypatch, sub="g-taken", email="user@example.com")

    response = auth_client.post(
        "/api/users/me/link-google/",
        data={"credential": "tok"},
        content_type="application/json",
    )
    assert response.status_code == 409


def test_unlink_google(auth_client, user):
    user.google_sub = "g-777"
    user.save(update_fields=["google_sub"])

    response = auth_client.delete("/api/users/me/link-google/")
    assert response.status_code == 200
    assert response.json()["google_linked"] is False
    user.refresh_from_db()
    assert user.google_sub is None


def test_link_requires_authentication(client):
    response = client.post(
        "/api/users/me/link-google/",
        data={"credential": "tok"},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)
