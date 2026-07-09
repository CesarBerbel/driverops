"""Testes da API de gestão de templates de notificação."""

import pytest
from django.core import mail
from django.test import Client

from apps.accounts.models import AuditLog
from apps.notifications.models import NotificationTemplate

pytestmark = pytest.mark.django_db

BASE = "/api/notification-templates/"


def _template_id(event="order_opened", channel="email"):
    return NotificationTemplate.objects.get(event=event, channel=channel).id


def test_requires_authentication():
    resp = Client().get(BASE)
    assert resp.status_code in (401, 403)


def test_admin_can_list_templates(admin_client):
    resp = admin_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    assert len(rows) >= 54


def test_filter_by_channel(admin_client):
    resp = admin_client.get(BASE, {"channel": "email"})
    assert resp.status_code == 200
    data = resp.json()
    rows = data["results"] if isinstance(data, dict) else data
    assert rows and all(row["channel"] == "email" for row in rows)


def test_metadata_exposes_variables_events_channels(admin_client):
    resp = admin_client.get(f"{BASE}metadata/")
    assert resp.status_code == 200
    body = resp.json()
    assert {group["key"] for group in body["variables"]} >= {
        "oficina",
        "cliente",
        "veiculo",
        "ordem_servico",
        "orcamento",
        "financeiro",
    }
    assert any(e["key"] == "quote_sent" for e in body["events"])
    assert {c["key"] for c in body["channels"]} == {
        "email",
        "whatsapp",
        "sms",
        "internal",
    }


def test_edit_blocked_without_permission(admin_client):
    # Administrador tem view, mas edit é crítica (só superuser/concessão).
    resp = admin_client.patch(
        f"{BASE}{_template_id()}/",
        data={"subject": "Novo assunto"},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_edit_blocked_for_role_without_view(tecnico_client):
    resp = tecnico_client.get(BASE)
    assert resp.status_code == 403


def test_superuser_can_edit_and_is_audited(super_client):
    tid = _template_id()
    resp = super_client.patch(
        f"{BASE}{tid}/",
        data={"subject": "Bem-vindo {{cliente.primeiro_nome}}"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["subject"] == "Bem-vindo {{cliente.primeiro_nome}}"
    assert body["is_customized"] is True
    assert body["updated_by_name"] == "Root"
    assert AuditLog.objects.filter(action="notification.template.update").exists()


def test_edit_rejects_unknown_variable(super_client):
    resp = super_client.patch(
        f"{BASE}{_template_id()}/",
        data={"html_content": "<p>{{cliente.inexistente}}</p>"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_restore_default(super_client):
    tid = _template_id()
    template = NotificationTemplate.objects.get(id=tid)
    original_subject = template.subject
    template.subject = "Mexido"
    template.is_customized = True
    template.save()

    resp = super_client.post(f"{BASE}{tid}/restore/")
    assert resp.status_code == 200
    template.refresh_from_db()
    assert template.subject == original_subject
    assert template.is_customized is False
    assert AuditLog.objects.filter(action="notification.template.restore").exists()


def test_deactivate_and_activate(super_client):
    tid = _template_id()
    resp = super_client.patch(
        f"{BASE}{tid}/", data={"is_active": False}, content_type="application/json"
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_preview_with_sample_data(super_client):
    resp = super_client.post(
        f"{BASE}{_template_id(event='ready_for_pickup')}/preview/",
        data={"context": "sample"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["errors"] == []
    assert "0042" in body["subject"]  # exemplo do número da OS
    assert "<table" in body["html"]


def test_test_send_email(super_client):
    resp = super_client.post(
        f"{BASE}{_template_id()}/test-send/",
        data={"to": "teste@example.com", "context": "sample"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["teste@example.com"]


def test_test_send_requires_permission(admin_client):
    resp = admin_client.post(
        f"{BASE}{_template_id()}/test-send/",
        data={"to": "teste@example.com"},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_test_send_requires_recipient(super_client):
    resp = super_client.post(
        f"{BASE}{_template_id()}/test-send/",
        data={"context": "sample"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_bulk_deactivate_and_activate(super_client):
    ids = list(
        NotificationTemplate.objects.filter(channel="email").values_list(
            "id", flat=True
        )[:3]
    )
    resp = super_client.post(
        f"{BASE}bulk-status/",
        data={"ids": ids, "is_active": False},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 3
    assert NotificationTemplate.objects.filter(id__in=ids, is_active=False).count() == 3
    # Reativa
    resp = super_client.post(
        f"{BASE}bulk-status/",
        data={"ids": ids, "is_active": True},
        content_type="application/json",
    )
    assert resp.json()["updated"] == 3
    assert NotificationTemplate.objects.filter(id__in=ids, is_active=True).count() == 3
    assert AuditLog.objects.filter(action="notification.template.bulk_status").exists()


def test_bulk_status_requires_permission(admin_client):
    ids = list(NotificationTemplate.objects.values_list("id", flat=True)[:2])
    resp = admin_client.post(
        f"{BASE}bulk-status/",
        data={"ids": ids, "is_active": False},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_bulk_status_validates_input(super_client):
    resp = super_client.post(
        f"{BASE}bulk-status/",
        data={"ids": [], "is_active": False},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_history_lists_changes(super_client):
    tid = _template_id()
    super_client.patch(
        f"{BASE}{tid}/",
        data={"subject": "Alterado {{cliente.nome}}"},
        content_type="application/json",
    )
    resp = super_client.get(f"{BASE}{tid}/history/")
    assert resp.status_code == 200
    rows = resp.json()
    assert any("subject" in row["changed"] for row in rows)
