"""Testes da máquina de estados da OS (transições, permissões, guards, histórico)."""

import pytest

from apps.accounts.models import AuditLog, Permission, UserPermission
from apps.orders.models import OrderStatusHistory, WorkOrder
from apps.orders.state_machine import system_advance_to_approved
from apps.quotes.models import Quote
from apps.workshop.models import OrderSettings

pytestmark = pytest.mark.django_db


def _grant(user, codename):
    permission = Permission.objects.get(codename=codename)
    UserPermission.objects.update_or_create(
        user=user,
        permission=permission,
        defaults={"grant_type": UserPermission.GrantType.GRANT},
    )


def _order(customer, vehicle, status="open"):
    return WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Barulho ao frear",
        status=status,
    )


def _transition(client, order, action, **body):
    return client.post(
        f"/api/work-orders/{order.id}/transition/",
        data={"action": action, **body},
        content_type="application/json",
    )


def _transitions(client, order):
    return client.get(f"/api/work-orders/{order.id}/transitions/")


# --- disponibilidade / consulta ------------------------------------------------


def test_transitions_endpoint_lists_available_actions(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    resp = _transitions(auth_client, order)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "open"
    actions = {t["action"] for t in body["transitions"]}
    # Administrador (kanban.move) vê as operacionais; não vê finalizar (crítica).
    assert "start_diagnosis" in actions
    assert "send_to_approval" in actions
    assert "finish" not in actions  # sem orders.finish


def test_finish_action_appears_only_with_permission(
    auth_client, user, customer, vehicle
):
    order = _order(customer, vehicle, status="ready")
    assert "finish" not in {
        t["action"] for t in _transitions(auth_client, order).json()["transitions"]
    }
    _grant(user, "orders.finish")
    assert "finish" in {
        t["action"] for t in _transitions(auth_client, order).json()["transitions"]
    }


# --- transições válidas / inválidas -------------------------------------------


def test_valid_action_moves_status(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    resp = _transition(auth_client, order, "start_diagnosis")
    assert resp.status_code == 200 and resp.json()["status"] == "diagnosing"


def test_invalid_action_for_current_status_is_rejected(auth_client, customer, vehicle):
    # Não dá para iniciar execução direto de "Aberta".
    order = _order(customer, vehicle, status="open")
    resp = _transition(auth_client, order, "start_execution")
    assert resp.status_code == 400
    order.refresh_from_db()
    assert order.status == "open"


def test_unknown_action_is_rejected(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    assert _transition(auth_client, order, "teleport").status_code == 400


def test_direct_status_edit_is_blocked(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    resp = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"status": "finished"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    order.refresh_from_db()
    assert order.status == "open"


# --- permissões ----------------------------------------------------------------


def test_finish_requires_permission(auth_client, user, customer, vehicle):
    order = _order(customer, vehicle, status="ready")
    assert _transition(auth_client, order, "finish").status_code == 403
    _grant(user, "orders.finish")
    assert _transition(auth_client, order, "finish").status_code == 200


# --- justificativa obrigatória -------------------------------------------------


def test_cancel_requires_reason(auth_client, user, customer, vehicle):
    _grant(user, "orders.cancel")
    order = _order(customer, vehicle, status="diagnosing")
    assert _transition(auth_client, order, "cancel").status_code == 400
    resp = _transition(auth_client, order, "cancel", reason="Cliente desistiu.")
    assert resp.status_code == 200 and resp.json()["status"] == "canceled"


def test_reject_records_rejected_status_with_reason(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="awaiting_approval")
    assert _transition(auth_client, order, "reject").status_code == 400
    resp = _transition(
        auth_client, order, "reject", reason="Cliente achou caro.", notes="Ligar depois"
    )
    assert resp.status_code == 200 and resp.json()["status"] == "rejected"


# --- histórico -----------------------------------------------------------------


def test_history_records_action_reason_source(auth_client, user, customer, vehicle):
    _grant(user, "orders.cancel")
    order = _order(customer, vehicle, status="open")
    _transition(auth_client, order, "cancel", reason="Duplicada.", notes="obs")
    entry = OrderStatusHistory.objects.filter(order=order, to_status="canceled").first()
    assert entry.action == "cancel"
    assert entry.reason == "Duplicada."
    assert entry.note == "obs"
    assert entry.source == OrderStatusHistory.Source.MANUAL
    # Auditoria da transição crítica.
    assert AuditLog.objects.filter(action="orders.transition.cancel").exists()


# --- reabertura ----------------------------------------------------------------


def test_reopen_requires_permission_reason_and_target(
    auth_client, user, customer, vehicle
):
    order = _order(customer, vehicle, status="finished")
    # Sem permissão especial.
    assert (
        _transition(
            auth_client, order, "reopen", target_status="in_progress", reason="x"
        ).status_code
        == 403
    )
    _grant(user, "orders.reopen")
    # Sem justificativa.
    assert (
        _transition(
            auth_client, order, "reopen", target_status="in_progress"
        ).status_code
        == 400
    )
    # Destino inválido.
    assert (
        _transition(
            auth_client, order, "reopen", target_status="finished", reason="Revisão"
        ).status_code
        == 400
    )
    resp = _transition(
        auth_client,
        order,
        "reopen",
        target_status="in_progress",
        reason="Cliente retornou com o mesmo problema.",
    )
    assert resp.status_code == 200 and resp.json()["status"] == "in_progress"


# --- guards configuráveis ------------------------------------------------------


def test_execution_blocked_without_approved_quote_when_configured(
    auth_client, customer, vehicle
):
    conf = OrderSettings.get_solo()
    conf.require_approved_quote_for_execution = True
    conf.save()
    order = _order(customer, vehicle, status="approved")
    resp = _transition(auth_client, order, "start_execution")
    assert resp.status_code == 400
    assert "orçamento aprovado" in resp.json()["detail"]
    # A ação aparece como bloqueada (available=False) na consulta.
    entry = next(
        t
        for t in _transitions(auth_client, order).json()["transitions"]
        if t["action"] == "start_execution"
    )
    assert entry["available"] is False and entry["block_reason"]
    # Com orçamento aprovado, libera.
    Quote.objects.create(work_order=order, status="approved")
    assert _transition(auth_client, order, "start_execution").status_code == 200


def test_finish_blocked_with_open_balance_when_configured(
    auth_client, user, customer, vehicle, service
):
    _grant(user, "orders.finish")
    conf = OrderSettings.get_solo()
    conf.require_payment_to_finish = True
    conf.save()
    order = _order(customer, vehicle, status="ready")
    order.service_items.create(service=service, quantity=1, unit_price="200.00")
    resp = _transition(auth_client, order, "finish")
    assert resp.status_code == 400
    assert "financeiro" in resp.json()["detail"].lower()


# --- integração com orçamento (transição de sistema) --------------------------


def test_quote_approval_advances_os_through_state_machine(customer, vehicle):
    order = _order(customer, vehicle, status="awaiting_approval")
    system_advance_to_approved(order)
    order.refresh_from_db()
    assert order.status == "approved"
    entry = OrderStatusHistory.objects.filter(order=order, to_status="approved").first()
    assert entry.action == "approve"
    assert entry.source == OrderStatusHistory.Source.APPROVAL


def test_system_advance_never_regresses(customer, vehicle):
    order = _order(customer, vehicle, status="in_progress")
    system_advance_to_approved(order)
    order.refresh_from_db()
    assert order.status == "in_progress"  # não regride


# --- transição forçada ---------------------------------------------------------


def test_force_transition_requires_permission_and_reason(
    auth_client, user, customer, vehicle
):
    order = _order(customer, vehicle, status="open")
    assert (
        _transition(
            auth_client, order, "force_transition", target_status="finished", reason="x"
        ).status_code
        == 403
    )
    _grant(user, "orders.force_transition")
    assert (
        _transition(
            auth_client, order, "force_transition", target_status="finished"
        ).status_code
        == 400
    )
    resp = _transition(
        auth_client,
        order,
        "force_transition",
        target_status="finished",
        reason="Correção manual.",
    )
    assert resp.status_code == 200 and resp.json()["status"] == "finished"
