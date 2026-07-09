"""Testes do inbox interno, matching e conversões."""

import pytest

from apps.accounts.models import AuditLog
from apps.leads.matching import analyze_lead, match_customer, match_vehicle
from apps.leads.models import LeadSettings, SiteLead
from apps.orders.models import WorkOrder

pytestmark = pytest.mark.django_db

BASE = "/api/leads/"


# --- matching ---


def test_match_customer_by_phone(customer):
    result = match_customer(phone="11988887777")
    assert result["confidence"] == "high"
    assert result["customer"]["id"] == customer.id


def test_match_vehicle_by_plate(vehicle):
    result = match_vehicle(plate="ABC1D23")
    assert result["found"] is True
    assert result["owner"]["id"] == vehicle.customer_id


def test_analyze_detects_divergent_vehicle(vehicle, customer):
    # Lead com a placa da Maria, mas telefone de outro cliente inexistente.
    lead = SiteLead.objects.create(
        name="Outro", phone="11900000000", vehicle_plate="ABC1D23", consent=True
    )
    other = type(customer).objects.create(name="Pedro", phone="11900000000", whatsapp="11900000000")
    analysis = analyze_lead(lead)
    assert analysis["vehicle_match"]["found"] is True
    assert analysis["verification"] == "divergent"
    assert analysis["vehicle_belongs_to_other_customer"] is True
    assert other.id != vehicle.customer_id


# --- permissões / inbox ---


def test_inbox_requires_view_permission(atendente_client, estoque_client, lead):
    assert atendente_client.get(BASE).status_code == 200
    assert estoque_client.get(BASE).status_code == 403


def test_pending_count(atendente_client, lead):
    resp = atendente_client.get(f"{BASE}pending-count/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 1


def test_detail_includes_analysis_and_indicators(atendente_client, lead):
    resp = atendente_client.get(f"{BASE}{lead.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert "analysis" in body
    assert "indicators" in body


# --- ações ---


def test_note_and_contact(atendente_client, lead):
    assert atendente_client.post(
        f"{BASE}{lead.id}/note/", data={"text": "Ligou, sem resposta"}, content_type="application/json"
    ).status_code == 200
    resp = atendente_client.post(f"{BASE}{lead.id}/contact/", data={"channel": "telefone"}, content_type="application/json")
    assert resp.status_code == 200
    lead.refresh_from_db()
    assert lead.status == "contacted"


def test_create_customer_and_vehicle_then_convert_os(atendente_client, lead):
    # Cria cliente a partir do pedido.
    r1 = atendente_client.post(f"{BASE}{lead.id}/create-customer/")
    assert r1.status_code == 201
    lead.refresh_from_db()
    assert lead.linked_customer is not None
    # Cria veículo.
    r2 = atendente_client.post(f"{BASE}{lead.id}/create-vehicle/")
    assert r2.status_code == 201
    lead.refresh_from_db()
    assert lead.linked_vehicle is not None
    # Converte em OS.
    r3 = atendente_client.post(f"{BASE}{lead.id}/convert-os/", content_type="application/json")
    assert r3.status_code == 201
    lead.refresh_from_db()
    assert lead.work_order is not None
    assert lead.status == "converted_os"
    assert WorkOrder.objects.filter(id=lead.work_order_id).exists()
    assert AuditLog.objects.filter(action="site_lead.convert_os").exists()


def test_create_customer_blocked_when_phone_already_exists(atendente_client, lead, customer):
    # Já existe cliente com o telefone do pedido -> criar novo é bloqueado.
    lead.phone = customer.phone
    lead.save(update_fields=["phone"])
    resp = atendente_client.post(f"{BASE}{lead.id}/create-customer/")
    assert resp.status_code == 400
    assert resp.json().get("code") == "customer_exists"


def test_convert_os_requires_customer_and_vehicle(atendente_client, lead):
    resp = atendente_client.post(f"{BASE}{lead.id}/convert-os/", content_type="application/json")
    assert resp.status_code == 400


def test_convert_os_blocks_divergent_vehicle(atendente_client, customer, vehicle):
    # Pedido com a placa da Maria, mas cliente vinculado é outro.
    lead = SiteLead.objects.create(name="Pedro", phone="11900001111", vehicle_plate="ABC1D23", consent=True)
    other = type(customer).objects.create(name="Pedro", phone="11900001111", whatsapp="11900001111")
    lead.linked_customer = other
    lead.linked_vehicle = vehicle  # pertence à Maria
    lead.save()
    resp = atendente_client.post(f"{BASE}{lead.id}/convert-os/", content_type="application/json")
    assert resp.status_code == 400
    assert resp.json().get("code") == "vehicle_divergent"


def test_convert_os_warns_open_os_until_confirmed(atendente_client, customer, vehicle):
    WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x", status="open"
    )
    lead = SiteLead.objects.create(name="Maria", phone="11988887777", vehicle_plate="ABC1D23", consent=True)
    lead.linked_customer = customer
    lead.linked_vehicle = vehicle
    lead.save()
    # Sem confirm: alerta.
    r1 = atendente_client.post(f"{BASE}{lead.id}/convert-os/", content_type="application/json")
    assert r1.status_code == 400
    assert r1.json().get("code") == "open_os"
    # Com confirm: prossegue.
    r2 = atendente_client.post(f"{BASE}{lead.id}/convert-os/", data={"confirm": True}, content_type="application/json")
    assert r2.status_code == 201


def test_convert_permission_required(estoque_client, lead):
    assert estoque_client.post(f"{BASE}{lead.id}/create-customer/").status_code == 403


# --- settings ---


def test_settings_get_and_config_permission(atendente_client, super_client):
    assert atendente_client.get("/api/lead-settings/").status_code == 200
    # Atendente não tem leads.config.
    assert atendente_client.patch(
        "/api/lead-settings/", data={"plate_required": False}, content_type="application/json"
    ).status_code == 403
    resp = super_client.patch(
        "/api/lead-settings/", data={"plate_required": False}, content_type="application/json"
    )
    assert resp.status_code == 200
    assert LeadSettings.get_solo().plate_required is False
