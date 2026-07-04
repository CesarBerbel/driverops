import pytest

from apps.workshop.models import KanbanSettings

pytestmark = pytest.mark.django_db


def test_requires_authentication(client):
    response = client.get("/api/kanban-settings/")
    assert response.status_code in (401, 403)


def test_get_creates_singleton_with_defaults(auth_client):
    response = auth_client.get("/api/kanban-settings/")
    assert response.status_code == 200
    columns = response.json()["columns"]
    assert [c["status"] for c in columns[:2]] == ["open", "diagnosing"]
    visibility = {c["status"]: c["visible"] for c in columns}
    # Finalizada e Cancelada vêm desmarcadas por padrão.
    assert visibility["finished"] is False
    assert visibility["canceled"] is False
    assert visibility["open"] is True
    assert KanbanSettings.objects.count() == 1


def test_authenticated_non_superuser_cannot_edit(auth_client):
    response = auth_client.patch(
        "/api/kanban-settings/",
        data={"columns": [{"status": "open", "visible": False}]},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_superuser_updates_visibility_and_order(super_client):
    payload = {
        "columns": [
            {"status": "finished", "visible": True},
            {"status": "open", "visible": False},
        ]
    }
    response = super_client.patch(
        "/api/kanban-settings/", data=payload, content_type="application/json"
    )
    assert response.status_code == 200
    columns = response.json()["columns"]
    # The two provided columns keep their order and flags at the front...
    assert columns[0] == {"status": "finished", "visible": True}
    assert columns[1] == {"status": "open", "visible": False}
    # ...and every remaining status is appended so the config stays complete.
    assert {c["status"] for c in columns} == {
        "open",
        "diagnosing",
        "awaiting_approval",
        "approved",
        "in_progress",
        "awaiting_parts",
        "testing",
        "ready",
        "finished",
        "canceled",
    }


def test_invalid_status_is_rejected(super_client):
    response = super_client.patch(
        "/api/kanban-settings/",
        data={"columns": [{"status": "banana", "visible": True}]},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_duplicate_status_is_rejected(super_client):
    response = super_client.patch(
        "/api/kanban-settings/",
        data={
            "columns": [
                {"status": "open", "visible": True},
                {"status": "open", "visible": False},
            ]
        },
        content_type="application/json",
    )
    assert response.status_code == 400
