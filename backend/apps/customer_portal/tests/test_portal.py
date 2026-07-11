"""Portal do cliente: solicitação de link, acesso por token e segurança."""

import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.customer_portal.models import (
    CustomerPortalSettings,
    PortalMessage,
    VehicleAccessToken,
)
from apps.customers.models import CustomerInteraction
from apps.orders.models import WorkOrder
from apps.vehicles.models import Vehicle

pytestmark = pytest.mark.django_db

REQUEST_URL = "/api/public/vehicle-access/request/"
NEUTRAL = "Se encontrarmos um veículo"


def _post(client, plate, **extra):
    return client.post(
        REQUEST_URL,
        data={"plate": plate, **extra},
        content_type="application/json",
    )


def _token_from_email():
    return re.search(r"/veiculo/(\S+)", mail.outbox[0].body).group(1)


def _issue(customer, vehicle, **kw):
    obj, raw = VehicleAccessToken.issue(
        customer=customer, vehicle=vehicle, email=customer.email, validity_hours=5, **kw
    )
    return obj, raw


# --- solicitação de link (neutralidade / não vazamento) ------------------------


def test_request_sends_link_when_vehicle_and_email_match(client, vehicle):
    resp = _post(client, "abc-1d23")  # placa com máscara/caixa diferente
    assert resp.status_code == 200
    assert NEUTRAL in resp.json()["detail"]
    assert VehicleAccessToken.objects.count() == 1
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["joao@example.com"]
    # O e-mail contém o link com o token bruto (que não está salvo em texto puro).
    raw = _token_from_email()
    assert VehicleAccessToken.objects.get().token_hash != raw


def test_request_is_neutral_and_silent_when_plate_unknown(client, vehicle):
    resp = _post(client, "ZZZ9Z99")
    assert resp.status_code == 200
    assert NEUTRAL in resp.json()["detail"]  # mesma mensagem -> não revela nada
    assert VehicleAccessToken.objects.count() == 0
    assert len(mail.outbox) == 0


def test_request_is_neutral_when_customer_has_no_email(client, vehicle):
    vehicle.customer.email = ""
    vehicle.customer.save()
    resp = _post(client, "ABC1D23")
    assert resp.status_code == 200
    assert VehicleAccessToken.objects.count() == 0
    assert len(mail.outbox) == 0


def test_honeypot_field_silently_succeeds_without_issuing(client, vehicle):
    resp = client.post(
        REQUEST_URL,
        data={"plate": "ABC1D23", "website": "http://spam"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert VehicleAccessToken.objects.count() == 0


def test_resend_cooldown_blocks_a_second_request(client, vehicle):
    _post(client, "ABC1D23")
    _post(client, "ABC1D23")  # dentro do cooldown -> não emite outro
    assert VehicleAccessToken.objects.count() == 1
    assert len(mail.outbox) == 1


# --- acesso por token ----------------------------------------------------------


def test_valid_token_returns_vehicle_portal(client, customer, vehicle, order):
    _, raw = _issue(customer, vehicle)
    resp = client.get(f"/api/public/vehicle-access/{raw}/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["vehicle"]["plate"] == "ABC1D23"
    assert body["customer_first_name"] == "João"
    assert body["current_order"]["number"] == order.number
    assert body["current_order"]["status_display"] == "Em execução"
    assert body["current_order"]["customer_report"] == "Barulho na frente"


def test_payload_never_exposes_internal_notes(client, customer, vehicle, order):
    _, raw = _issue(customer, vehicle)
    resp = client.get(f"/api/public/vehicle-access/{raw}/")
    assert "SEGREDO INTERNO" not in resp.content.decode()


def test_history_is_limited_to_the_token_vehicle(client, customer, vehicle, order):
    # OS finalizada do MESMO veículo -> entra no histórico.
    WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-01-01", status="finished"
    )
    # OS de OUTRO veículo do mesmo cliente -> NÃO pode aparecer.
    other = Vehicle.objects.create(
        customer=customer, license_plate="XYZ9Z99", brand="Fiat", model="Uno"
    )
    WorkOrder.objects.create(
        customer=customer, vehicle=other, opened_at="2026-02-02", status="finished"
    )
    _, raw = _issue(customer, vehicle)
    resp = client.get(f"/api/public/vehicle-access/{raw}/")
    body = resp.json()
    # Só a OS finalizada do veículo do token entra no histórico; a do outro
    # veículo não aparece nem vaza a placa.
    assert len(body["history"]) == 1
    assert "XYZ9Z99" not in resp.content.decode()


def test_expired_token_returns_410(client, customer, vehicle):
    obj, raw = _issue(customer, vehicle)
    obj.expires_at = timezone.now() - timedelta(hours=1)
    obj.save(update_fields=["expires_at"])
    resp = client.get(f"/api/public/vehicle-access/{raw}/")
    assert resp.status_code == 410
    assert resp.json()["code"] == "expired"


def test_invalid_token_returns_404_without_details(client):
    resp = client.get("/api/public/vehicle-access/lixo-invalido/")
    assert resp.status_code == 404
    assert resp.json()["code"] == "invalid"


def test_single_use_token_is_consumed_after_first_access(client, customer, vehicle):
    conf = CustomerPortalSettings.get_solo()
    conf.single_use_token = True
    conf.save()
    _, raw = _issue(customer, vehicle)
    assert client.get(f"/api/public/vehicle-access/{raw}/").status_code == 200
    # Segundo acesso -> já usado -> 410.
    assert client.get(f"/api/public/vehicle-access/{raw}/").status_code == 410


# --- mensagem do cliente -------------------------------------------------------


def test_message_creates_record_and_internal_interaction(client, customer, vehicle):
    _, raw = _issue(customer, vehicle)
    resp = client.post(
        f"/api/public/vehicle-access/{raw}/message/",
        data={"kind": "callback", "message": "Podem me ligar?"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert PortalMessage.objects.filter(vehicle=vehicle, kind="callback").count() == 1
    # Vira um registro interno (Cliente 360) para a oficina retornar.
    interaction = CustomerInteraction.objects.get(customer=customer, channel="portal")
    assert interaction.interaction_type == CustomerInteraction.Type.RETURN
    assert "Podem me ligar?" in interaction.content


def test_message_requires_text(client, customer, vehicle):
    _, raw = _issue(customer, vehicle)
    resp = client.post(
        f"/api/public/vehicle-access/{raw}/message/",
        data={"kind": "other", "message": "   "},
        content_type="application/json",
    )
    assert resp.status_code == 400
