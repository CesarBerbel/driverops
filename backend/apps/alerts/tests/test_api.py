"""Testes da API da Central: listagem, contador, leitura, massa, permissões."""

import pytest

from apps.alerts.models import Notification, NotifModule, NotifStatus
from apps.alerts.tests.conftest import make_notification

pytestmark = pytest.mark.django_db

BASE = "/api/notifications/"


def test_list_requires_authentication(client):
    assert client.get(BASE).status_code == 401


def test_list_requires_alerts_view(roleless_client):
    assert roleless_client.get(BASE).status_code == 403


def test_list_only_own_notifications(atendente_client, atendente, financeiro):
    make_notification(atendente, title="Meu aviso")
    make_notification(financeiro, title="Aviso de outro")
    resp = atendente_client.get(BASE)
    assert resp.status_code == 200
    titles = [n["title"] for n in resp.json()]
    assert "Meu aviso" in titles
    assert "Aviso de outro" not in titles


def test_unread_count(atendente_client, atendente):
    make_notification(atendente)
    make_notification(atendente)
    read = make_notification(atendente)
    read.status = NotifStatus.READ
    read.save(update_fields=["status"])
    resp = atendente_client.get(f"{BASE}unread-count/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


def test_mark_one_read_updates_counter(atendente_client, atendente):
    n = make_notification(atendente)
    assert atendente_client.post(f"{BASE}{n.id}/read/").status_code == 200
    n.refresh_from_db()
    assert n.status == NotifStatus.READ and n.read_at is not None
    assert atendente_client.get(f"{BASE}unread-count/").json()["count"] == 0


def test_mark_unread(atendente_client, atendente):
    n = make_notification(atendente, status=NotifStatus.READ)
    assert atendente_client.post(f"{BASE}{n.id}/unread/").status_code == 200
    n.refresh_from_db()
    assert n.status == NotifStatus.UNREAD


def test_mark_all_read(atendente_client, atendente):
    make_notification(atendente)
    make_notification(atendente)
    resp = atendente_client.post(f"{BASE}mark-all-read/")
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2
    assert atendente_client.get(f"{BASE}unread-count/").json()["count"] == 0


def test_mark_read_bulk_only_selected(atendente_client, atendente):
    a = make_notification(atendente)
    b = make_notification(atendente)
    resp = atendente_client.post(
        f"{BASE}mark-read/", data={"ids": [a.id]}, content_type="application/json"
    )
    assert resp.status_code == 200 and resp.json()["updated"] == 1
    a.refresh_from_db()
    b.refresh_from_db()
    assert a.status == NotifStatus.READ and b.status == NotifStatus.UNREAD


def test_cannot_mark_other_users_notification(atendente_client, financeiro):
    other = make_notification(financeiro)
    # get_object filtra por recipient -> 404 para aviso de outro usuário.
    assert atendente_client.post(f"{BASE}{other.id}/read/").status_code == 404
    other.refresh_from_db()
    assert other.status == NotifStatus.UNREAD


def test_archive_hidden_by_default(atendente_client, atendente):
    n = make_notification(atendente)
    assert atendente_client.post(f"{BASE}{n.id}/archive/").status_code == 200
    n.refresh_from_db()
    assert n.status == NotifStatus.ARCHIVED
    # some por padrão
    titles = [x["title"] for x in atendente_client.get(BASE).json()]
    assert n.title not in titles
    # aparece com filtro status=archived
    archived = atendente_client.get(f"{BASE}?status=archived").json()
    assert any(x["id"] == n.id for x in archived)


def test_filter_by_module_and_search(atendente_client, atendente):
    make_notification(atendente, title="Estoque baixo", module=NotifModule.PARTS)
    make_notification(atendente, title="Novo pedido", module=NotifModule.LEADS)
    parts = atendente_client.get(f"{BASE}?module=parts").json()
    assert [n["title"] for n in parts] == ["Estoque baixo"]
    found = atendente_client.get(f"{BASE}?q=pedido").json()
    assert [n["title"] for n in found] == ["Novo pedido"]


def test_limit_param(atendente_client, atendente):
    for i in range(5):
        make_notification(atendente, title=f"Aviso {i}")
    resp = atendente_client.get(f"{BASE}?limit=2")
    assert len(resp.json()) == 2


# --- manual ---


def test_manual_requires_send_permission(atendente_client, atendente):
    resp = atendente_client.post(
        f"{BASE}manual/",
        data={"recipient_ids": [atendente.id], "title": "Oi", "message": "teste"},
        content_type="application/json",
    )
    assert resp.status_code == 403


def test_manual_send_by_superuser(super_client, atendente):
    resp = super_client.post(
        f"{BASE}manual/",
        data={"role_key": "atendente", "title": "Aviso", "message": "Cheguei"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert Notification.objects.filter(recipient=atendente, title="Aviso").exists()


def test_manual_requires_a_target(super_client):
    resp = super_client.post(
        f"{BASE}manual/",
        data={"title": "Aviso", "message": "sem destino"},
        content_type="application/json",
    )
    assert resp.status_code == 400


# --- rules / preferences ---


def test_rules_get_and_patch_permission(atendente_client, super_client):
    # Atendente vê (alerts.view) mas não configura (alerts.configure).
    assert atendente_client.get("/api/notification-rules/").status_code == 200
    patch = {"notif_type": "os_overdue", "is_enabled": False, "lead_time_hours": 12}
    assert (
        atendente_client.patch(
            "/api/notification-rules/", data=patch, content_type="application/json"
        ).status_code
        == 403
    )
    resp = super_client.patch(
        "/api/notification-rules/", data=patch, content_type="application/json"
    )
    assert resp.status_code == 200
    from apps.alerts.models import NotificationRule

    rule = NotificationRule.objects.get(notif_type="os_overdue")
    assert rule.is_enabled is False and rule.lead_time_hours == 12


def test_preferences_get_and_patch(atendente_client, atendente):
    assert atendente_client.get("/api/notification-preferences/").status_code == 200
    resp = atendente_client.patch(
        "/api/notification-preferences/",
        data={"only_high_priority": True, "muted_modules": ["financial"]},
        content_type="application/json",
    )
    assert resp.status_code == 200
    from apps.alerts.models import NotificationPreference

    pref = NotificationPreference.objects.get(user=atendente)
    assert pref.only_high_priority is True and pref.muted_modules == ["financial"]
