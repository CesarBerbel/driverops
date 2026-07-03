import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

pytestmark = pytest.mark.django_db


def test_request_with_existing_email_sends_email_with_correct_link(
    client, user, settings
):
    response = client.post(
        "/api/auth/password-reset/",
        data={"email": user.email},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert user.email in sent.to
    assert settings.FRONTEND_URL + "/reset-password?uid=" in sent.body
    assert "token=" in sent.body


def test_request_with_nonexistent_email_returns_same_generic_response(client):
    response = client.post(
        "/api/auth/password-reset/",
        data={"email": "nobody@example.com"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert len(mail.outbox) == 0


def _valid_uid_token(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return uid, token


def test_confirm_with_valid_token_updates_password_and_allows_login(client, user):
    uid, token = _valid_uid_token(user)

    response = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": token,
            "new_password": "BrandNewPass456",
            "new_password_confirm": "BrandNewPass456",
        },
        content_type="application/json",
    )
    assert response.status_code == 200

    login_response = client.post(
        "/api/auth/login/",
        data={"email": user.email, "password": "BrandNewPass456"},
        content_type="application/json",
    )
    assert login_response.status_code == 200


def test_confirm_with_invalid_token_returns_400(client, user):
    uid, _ = _valid_uid_token(user)

    response = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": "not-a-real-token",
            "new_password": "BrandNewPass456",
            "new_password_confirm": "BrandNewPass456",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_confirm_token_cannot_be_reused_after_password_changed(client, user):
    uid, token = _valid_uid_token(user)

    first = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": token,
            "new_password": "BrandNewPass456",
            "new_password_confirm": "BrandNewPass456",
        },
        content_type="application/json",
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": token,
            "new_password": "AnotherPass789",
            "new_password_confirm": "AnotherPass789",
        },
        content_type="application/json",
    )
    assert second.status_code == 400


def test_confirm_rejects_mismatched_passwords(client, user):
    uid, token = _valid_uid_token(user)

    response = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": token,
            "new_password": "BrandNewPass456",
            "new_password_confirm": "SomethingElse789",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_confirm_rejects_weak_password(client, user):
    uid, token = _valid_uid_token(user)

    response = client.post(
        "/api/auth/password-reset/confirm/",
        data={
            "uid": uid,
            "token": token,
            "new_password": "123",
            "new_password_confirm": "123",
        },
        content_type="application/json",
    )
    assert response.status_code == 400
