import datetime

import pytest

from apps.quotes.services import create_quote_from_order

pytestmark = pytest.mark.django_db


def _sent_quote(work_order, user):
    quote = create_quote_from_order(work_order, user=user)
    quote.status = "sent"
    quote.save()
    return quote


def test_public_detail_marks_viewed_and_hides_internal_data(work_order, user):
    quote = _sent_quote(work_order, user)
    from django.test import Client

    anon = Client()
    response = anon.get(f"/api/public/quotes/{quote.public_token}/")
    assert response.status_code == 200
    body = response.json()
    assert body["number"] == quote.number
    assert body["can_decide"] is True
    assert body["workshop"]  # dados da oficina disponíveis
    assert body["terms"]  # termos das Configurações
    # Não vaza token/e-mails internos.
    assert "public_token" not in body
    assert "sent_to_email" not in body

    quote.refresh_from_db()
    assert quote.status == "viewed"


def test_public_isolation_unknown_token_is_404(client):
    response = client.get("/api/public/quotes/nao-existe/")
    assert response.status_code == 404


def test_public_approve_records_terms_and_metadata(work_order, user):
    quote = _sent_quote(work_order, user)
    from django.test import Client

    anon = Client()
    response = anon.post(
        f"/api/public/quotes/{quote.public_token}/approve/",
        data={"client_name": "Maria Silva", "terms_accepted": True},
        content_type="application/json",
        HTTP_USER_AGENT="Mozilla/Test",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

    quote.refresh_from_db()
    assert quote.approval_channel == "email_link"
    assert quote.terms_accepted is True
    assert quote.client_name == "Maria Silva"
    assert quote.decision_user_agent == "Mozilla/Test"
    assert quote.decision_ip
    work_order.refresh_from_db()
    assert work_order.status == "approved"


def test_public_approve_requires_terms_acceptance(work_order, user):
    quote = _sent_quote(work_order, user)
    from django.test import Client

    anon = Client()
    response = anon.post(
        f"/api/public/quotes/{quote.public_token}/approve/",
        data={"client_name": "Maria Silva", "terms_accepted": False},
        content_type="application/json",
    )
    assert response.status_code == 400
    quote.refresh_from_db()
    assert quote.status == "sent"


def test_public_reject_with_reason(work_order, user):
    quote = _sent_quote(work_order, user)
    from django.test import Client

    anon = Client()
    response = anon.post(
        f"/api/public/quotes/{quote.public_token}/reject/",
        data={"reason": "Preço alto", "client_name": "Maria"},
        content_type="application/json",
    )
    assert response.status_code == 200
    quote.refresh_from_db()
    assert quote.status == "rejected"
    assert quote.rejection_reason == "Preço alto"


def test_public_decision_locked_after_decided(work_order, user):
    quote = _sent_quote(work_order, user)
    quote.status = "approved"
    quote.save()
    from django.test import Client

    anon = Client()
    response = anon.post(
        f"/api/public/quotes/{quote.public_token}/approve/",
        data={"client_name": "Maria", "terms_accepted": True},
        content_type="application/json",
    )
    assert response.status_code == 409


def test_public_expired_when_past_validity(work_order, user):
    quote = _sent_quote(work_order, user)
    quote.valid_until = datetime.date(2020, 1, 1)
    quote.save()
    from django.test import Client

    anon = Client()
    response = anon.get(f"/api/public/quotes/{quote.public_token}/")
    assert response.status_code == 200
    assert response.json()["status"] == "expired"
    assert response.json()["can_decide"] is False
