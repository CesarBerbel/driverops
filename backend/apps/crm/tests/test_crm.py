"""Testes do CRM inteligente: geração de sugestões, ações, IA, config, notificação."""

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from apps.accounts.models import AuditLog
from apps.alerts.models import Notification
from apps.crm.models import (
    CrmCampaign,
    CrmSettings,
    CrmSuggestion,
    CrmTask,
    SuggestionStatus,
    SuggestionType,
)
from apps.crm.rules import run_rules
from apps.crm.tests.conftest import _user, make_quote

pytestmark = pytest.mark.django_db

BASE = "/api/crm/suggestions/"


# --- motor de regras ---


def test_quote_followup_suggestion_is_generated(order):
    make_quote(order, status="sent", sent_days_ago=3)
    created = run_rules()
    types = {s.suggestion_type for s in created}
    assert SuggestionType.QUOTE_FOLLOWUP in types
    s = CrmSuggestion.objects.get(suggestion_type=SuggestionType.QUOTE_FOLLOWUP)
    assert s.priority == "high"
    assert (
        "orçamento" in s.suggested_text.lower() or "dúvida" in s.suggested_text.lower()
    )


def test_rules_are_idempotent(order):
    make_quote(order, status="sent", sent_days_ago=3)
    run_rules()
    second = run_rules()
    assert second == []  # dedup impede duplicar
    assert (
        CrmSuggestion.objects.filter(
            suggestion_type=SuggestionType.QUOTE_FOLLOWUP
        ).count()
        == 1
    )


def test_os_ready_suggestion(order):
    order.status = "ready"
    order.save(update_fields=["status"])
    # força "há mais de 1 dia" via status_history
    from apps.orders.models import OrderStatusHistory

    OrderStatusHistory.objects.create(
        order=order, from_status="testing", to_status="ready"
    )
    OrderStatusHistory.objects.filter(order=order).update(
        created_at=order.created_at - timedelta(days=3)
    )
    created = run_rules()
    assert any(s.suggestion_type == SuggestionType.OS_READY for s in created)


def test_lead_followup_suggestion(db):
    from django.utils import timezone

    from apps.leads.models import SiteLead

    lead = SiteLead.objects.create(name="João", phone="11999998888", consent=True)
    SiteLead.objects.filter(pk=lead.pk).update(
        created_at=timezone.now() - timedelta(hours=10)
    )
    created = run_rules()
    assert any(s.suggestion_type == SuggestionType.LEAD_FOLLOWUP for s in created)


def test_seasonal_campaign_with_custom_holiday(db):
    conf = CrmSettings.get_solo()
    near = (date.today() + timedelta(days=5)).isoformat()
    conf.custom_holidays = [{"date": near, "name": "Feriado Teste"}]
    conf.save()
    created = run_rules()
    seasonal = [
        s for s in created if s.suggestion_type == SuggestionType.SEASONAL_CAMPAIGN
    ]
    assert len(seasonal) == 1
    assert seasonal[0].customer is None


def test_disabled_module_generates_nothing(order):
    conf = CrmSettings.get_solo()
    conf.is_active = False
    conf.save()
    make_quote(order, status="sent", sent_days_ago=3)
    assert run_rules() == []


def test_high_priority_suggestion_notifies_team(order):
    # Um atendente (crm.view + alerts.view) deve receber a notificação.
    _user("recv@example.com", "atendente")
    make_quote(order, status="sent", sent_days_ago=3)
    run_rules()
    notif = Notification.objects.filter(notif_type="crm_suggestion").first()
    assert notif is not None
    # O link leva direto para a mensagem da sugestão (deep link com o id).
    assert notif.url == f"/crm?suggestion={notif.related_id}"


# --- API / permissões / ações ---


def test_list_requires_permission(estoque_client, atendente_client, order):
    make_quote(order, status="sent", sent_days_ago=3)
    run_rules()
    assert estoque_client.get(BASE).status_code == 403
    resp = atendente_client.get(BASE)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def _one(order):
    make_quote(order, status="sent", sent_days_ago=3)
    run_rules()
    return CrmSuggestion.objects.first()


def test_approve_dismiss_snooze_complete(atendente_client, order):
    s = _one(order)
    assert atendente_client.post(f"{BASE}{s.id}/approve/").status_code == 200
    s.refresh_from_db()
    assert s.status == SuggestionStatus.IN_ANALYSIS
    assert s.events.exists()

    assert (
        atendente_client.post(
            f"{BASE}{s.id}/snooze/", data={"days": 3}, content_type="application/json"
        ).status_code
        == 200
    )
    s.refresh_from_db()
    assert s.status == SuggestionStatus.SNOOZED and s.snoozed_until is not None

    assert atendente_client.post(f"{BASE}{s.id}/complete/").status_code == 200
    s.refresh_from_db()
    assert s.status == SuggestionStatus.COMPLETED and s.completed_at is not None
    assert AuditLog.objects.filter(action="crm.suggestion.status").exists()


def test_dismiss_and_edit_text(atendente_client, order):
    s = _one(order)
    assert atendente_client.post(f"{BASE}{s.id}/dismiss/").status_code == 200
    s.refresh_from_db()
    assert s.status == SuggestionStatus.IGNORED

    edit = atendente_client.patch(
        f"{BASE}{s.id}/",
        data={"suggested_text": "Texto revisado pelo usuário."},
        content_type="application/json",
    )
    assert edit.status_code == 200
    assert edit.json()["suggested_text"] == "Texto revisado pelo usuário."


def test_to_task_and_to_campaign(atendente_client, order):
    s = _one(order)
    task = atendente_client.post(
        f"{BASE}{s.id}/to-task/",
        data={"title": "Ligar"},
        content_type="application/json",
    )
    assert task.status_code == 201
    assert CrmTask.objects.filter(suggestion=s).exists()

    camp = atendente_client.post(
        f"{BASE}{s.id}/to-campaign/", content_type="application/json"
    )
    assert camp.status_code == 201
    assert CrmCampaign.objects.exists()


# --- tarefas ---

TASKS = "/api/crm/tasks/"


def test_task_list_requires_permission(estoque_client, atendente_client, order):
    _one(order)  # gera uma sugestão para virar tarefa
    s = CrmSuggestion.objects.first()
    from apps.crm import services

    services.to_task(s, actor=None, title="Ligar para a Maria")
    assert estoque_client.get(TASKS).status_code == 403
    resp = atendente_client.get(TASKS)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    row = body[0]
    assert row["title"] == "Ligar para a Maria"
    assert row["customer_name"] == "Maria Silva"
    assert row["vehicle_plate"] == "ABC1D23"
    assert row["status"] == "open"


def test_task_create_update_delete_flow(atendente_client, customer):
    created = atendente_client.post(
        TASKS,
        data={"title": "Retornar ligação", "customer": customer.id, "priority": "high"},
        content_type="application/json",
    )
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert CrmTask.objects.get(pk=task_id).status == "open"
    assert AuditLog.objects.filter(action="crm.task.created").exists()

    # conclui a tarefa via PATCH
    done = atendente_client.patch(
        f"{TASKS}{task_id}/",
        data={"status": "done"},
        content_type="application/json",
    )
    assert done.status_code == 200
    assert done.json()["status"] == "done"
    assert AuditLog.objects.filter(action="crm.task.update").exists()

    deleted = atendente_client.delete(f"{TASKS}{task_id}/")
    assert deleted.status_code == 204
    assert not CrmTask.objects.filter(pk=task_id).exists()
    assert AuditLog.objects.filter(action="crm.task.deleted").exists()


def test_task_create_requires_assign_permission(tecnico_client, customer):
    # Técnico tem crm.view mas não crm.assign_task.
    resp = tecnico_client.post(
        TASKS,
        data={"title": "X", "customer": customer.id},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_task_filters_open_and_status(atendente_client, customer):
    from apps.crm.models import CrmTask as T

    T.objects.create(title="Aberta", customer=customer, status="open")
    T.objects.create(title="Concluida", customer=customer, status="done")
    open_only = atendente_client.get(f"{TASKS}?open=1").json()
    assert [t["title"] for t in open_only] == ["Aberta"]
    done_only = atendente_client.get(f"{TASKS}?status=done").json()
    assert [t["title"] for t in done_only] == ["Concluida"]


# --- IA ---


def test_generate_message_uses_ai(atendente_client, order):
    s = _one(order)
    from apps.ai_assistant.models import AISettings

    conf = AISettings.get_solo()
    conf.is_active = True
    conf.save()
    with patch("apps.crm.ai.get_provider") as gp:
        gp.return_value.generate.return_value = type(
            "R", (), {"text": "Mensagem gerada pela IA.", "model": "gpt-4o-mini"}
        )()
        resp = atendente_client.post(f"{BASE}{s.id}/generate-message/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_used"] is True
    assert body["text"] == "Mensagem gerada pela IA."


def test_generate_message_falls_back_when_ai_unavailable(atendente_client, order):
    s = _one(order)
    from apps.ai_assistant.models import AISettings

    conf = AISettings.get_solo()
    conf.is_active = False  # IA desativada -> fallback para o template
    conf.save()
    resp = atendente_client.post(f"{BASE}{s.id}/generate-message/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_used"] is False
    assert body["text"] == s.suggested_text


def test_generate_message_requires_use_ai_permission(tecnico_client, order):
    # Técnico tem crm.view mas não crm.use_ai.
    s = _one(order)
    assert tecnico_client.post(f"{BASE}{s.id}/generate-message/").status_code == 403


# --- configurações ---


def test_settings_get_and_configure_permission(atendente_client, super_client):
    assert atendente_client.get("/api/crm/settings/").status_code == 200
    # Atendente não configura (crítica).
    assert (
        atendente_client.patch(
            "/api/crm/settings/",
            data={"quote_followup_days": 5},
            content_type="application/json",
        ).status_code
        == 403
    )
    resp = super_client.patch(
        "/api/crm/settings/",
        data={"quote_followup_days": 5},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert CrmSettings.get_solo().quote_followup_days == 5
