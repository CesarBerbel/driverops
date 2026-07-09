"""Testes do formulário público de pedidos do site."""

import pytest
from django.core import mail
from django.test import Client

from apps.leads.models import LeadEvent, LeadSettings, SiteLead

pytestmark = pytest.mark.django_db

URL = "/api/public/leads/"
CFG = "/api/public/lead-config/"


def _payload(**over):
    data = {
        "name": "João Souza",
        "phone": "(11) 99999-8888",
        "email": "joao@example.com",
        "vehicle_plate": "abc1d23",
        "vehicle_brand": "VW",
        "vehicle_model": "Gol",
        "request_type": "diagnostic",
        "best_period": "morning",
        "message": "Barulho na frente",
        "consent": True,
    }
    data.update(over)
    return data


def test_public_config_accessible_without_auth():
    resp = Client().get(CFG)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_active"] is True
    assert any(t["key"] == "diagnostic" for t in body["request_types"])


def test_visitor_creates_lead_without_login():
    resp = Client().post(URL, data=_payload(), content_type="application/json")
    assert resp.status_code == 201
    assert "contato" in resp.json()["detail"].lower()
    lead = SiteLead.objects.get()
    assert lead.name == "João Souza"
    assert lead.phone == "11999998888"  # normalizado
    assert lead.vehicle_plate == "ABC1D23"  # normalizado
    assert lead.status == "new"
    # Evento de criação registrado.
    assert LeadEvent.objects.filter(lead=lead, event_type="created").exists()


def test_honeypot_blocks_spam():
    resp = Client().post(
        URL, data=_payload(website="http://spam"), content_type="application/json"
    )
    assert resp.status_code == 400
    assert SiteLead.objects.count() == 0


def test_consent_required_when_configured():
    resp = Client().post(URL, data=_payload(consent=False), content_type="application/json")
    assert resp.status_code == 400


def test_plate_required_by_default():
    resp = Client().post(URL, data=_payload(vehicle_plate=""), content_type="application/json")
    assert resp.status_code == 400


def test_plate_optional_when_allowed():
    conf = LeadSettings.get_solo()
    conf.allow_without_vehicle = True
    conf.save()
    resp = Client().post(URL, data=_payload(vehicle_plate=""), content_type="application/json")
    assert resp.status_code == 201


def test_form_disabled_returns_403():
    conf = LeadSettings.get_solo()
    conf.is_active = False
    conf.save()
    resp = Client().post(URL, data=_payload(), content_type="application/json")
    assert resp.status_code == 403
    assert SiteLead.objects.count() == 0


def test_auto_reply_email_when_enabled():
    conf = LeadSettings.get_solo()
    conf.auto_reply_enabled = True
    conf.save()
    Client().post(URL, data=_payload(), content_type="application/json")
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["joao@example.com"]
