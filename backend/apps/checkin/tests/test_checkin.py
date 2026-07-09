"""Testes do check-in do veículo: criação, avarias, fotos, itens, conclusão."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import AuditLog
from apps.checkin.models import VehicleCheckIn, VehicleDamage

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


def _png(name="foto.png"):
    return SimpleUploadedFile(name, PNG, content_type="image/png")


def _start(client, order):
    return client.post(f"/api/work-orders/{order.id}/check-in/")


# --- criação / permissões ---


def test_get_before_start_returns_404(atendente_client, order):
    assert (
        atendente_client.get(f"/api/work-orders/{order.id}/check-in/").status_code
        == 404
    )


def test_start_creates_check_in_with_default_items(atendente_client, order):
    resp = _start(atendente_client, order)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "in_progress"
    assert len(body["items"]) == 15
    assert VehicleCheckIn.objects.filter(order=order).count() == 1
    assert AuditLog.objects.filter(action="checkin.started").exists()


def test_start_is_idempotent(atendente_client, order):
    _start(atendente_client, order)
    resp = _start(atendente_client, order)
    assert resp.status_code == 200
    assert VehicleCheckIn.objects.filter(order=order).count() == 1


def test_requires_permission(estoque_client, order):
    assert (
        estoque_client.get(f"/api/work-orders/{order.id}/check-in/").status_code == 403
    )
    assert (
        estoque_client.post(f"/api/work-orders/{order.id}/check-in/").status_code == 403
    )


# --- avarias ---


def _check_in(order, client):
    r = _start(client, order)
    assert r.status_code in (200, 201), (r.status_code, r.content[:300])
    return r.json()


def test_add_edit_delete_damage_and_sequence(atendente_client, order):
    ci = _check_in(order, atendente_client)
    # Adiciona duas avarias -> sequência 1 e 2.
    r1 = atendente_client.post(
        "/api/check-in-damages/",
        data={
            "check_in": ci["id"],
            "x": "30.5",
            "y": "40",
            "severity": "light",
            "description": "Risco",
        },
        content_type="application/json",
    )
    assert r1.status_code == 201
    r2 = atendente_client.post(
        "/api/check-in-damages/",
        data={
            "check_in": ci["id"],
            "x": "60",
            "y": "20",
            "severity": "severe",
            "description": "Amassado",
        },
        content_type="application/json",
    )
    damages = r2.json()["damages"]
    assert [d["sequence"] for d in damages] == [1, 2]

    # Edita severidade (muda a cor no mapa) da primeira.
    first = damages[0]
    edit = atendente_client.patch(
        f"/api/check-in-damages/{first['id']}/",
        data={"severity": "medium"},
        content_type="application/json",
    )
    assert edit.status_code == 200
    updated = next(d for d in edit.json()["damages"] if d["id"] == first["id"])
    assert updated["severity"] == "medium"
    assert updated["severity_display"] == "Média"

    # Remove a segunda.
    second = damages[1]
    rm = atendente_client.delete(f"/api/check-in-damages/{second['id']}/")
    assert rm.status_code == 200
    assert len(rm.json()["damages"]) == 1
    assert AuditLog.objects.filter(action="checkin.damage_removed").exists()


def test_damage_requires_description(atendente_client, order):
    ci = _check_in(order, atendente_client)
    resp = atendente_client.post(
        "/api/check-in-damages/",
        data={
            "check_in": ci["id"],
            "x": "10",
            "y": "10",
            "severity": "light",
            "description": "",
        },
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "description" in resp.json()


def test_upload_photo_to_damage(atendente_client, order):
    ci = _check_in(order, atendente_client)
    dmg = VehicleDamage.objects.create(
        check_in_id=ci["id"], x=10, y=10, description="x", severity="light", sequence=1
    )
    resp = atendente_client.post(
        f"/api/check-in-damages/{dmg.id}/photos/", data={"file": _png()}
    )
    assert resp.status_code == 201
    body = resp.json()
    photo_damage = next(d for d in body["damages"] if d["id"] == dmg.id)
    assert len(photo_damage["photos"]) == 1
    assert body["summary"]["photo_count"] == 1


# --- fotos gerais / itens / objetos ---


def test_add_general_photo(atendente_client, order, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    ci = _check_in(order, atendente_client)
    resp = atendente_client.post(
        f"/api/check-ins/{ci['id']}/photos/",
        data={"file": _png(), "category": "front", "caption": "Frente"},
    )
    assert resp.status_code == 201
    assert resp.json()["photos"][0]["category"] == "front"


def test_update_items_marks_absent(atendente_client, order):
    ci = _check_in(order, atendente_client)
    item = ci["items"][0]
    resp = atendente_client.patch(
        f"/api/check-ins/{ci['id']}/items/",
        data={"items": [{"id": item["id"], "status": "absent", "notes": "não veio"}]},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    changed = next(i for i in body["items"] if i["id"] == item["id"])
    assert changed["status"] == "absent"
    assert body["summary"]["absent_items_count"] == 1


def test_add_belonging(atendente_client, order):
    ci = _check_in(order, atendente_client)
    resp = atendente_client.post(
        f"/api/check-ins/{ci['id']}/belongings/",
        data={"description": "Mochila no banco traseiro", "location": "Banco traseiro"},
        content_type="application/json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["belongings"][0]["description"] == "Mochila no banco traseiro"
    assert body["summary"]["has_belongings"] is True


def test_patch_general_fields(atendente_client, order):
    ci = _check_in(order, atendente_client)
    resp = atendente_client.patch(
        f"/api/check-ins/{ci['id']}/",
        data={
            "mileage": 85000,
            "fuel_level": "half",
            "general_notes": "Veículo chegou de guincho.",
        },
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mileage"] == 85000
    assert body["fuel_level_display"] == "1/2"


# --- conclusão / reabertura / bloqueio ---


def test_complete_locks_and_reopen_requires_permission(
    atendente_client, super_client, order
):
    ci = _check_in(order, atendente_client)
    VehicleDamage.objects.create(
        check_in_id=ci["id"], x=10, y=10, description="x", severity="light", sequence=1
    )
    done = atendente_client.post(f"/api/check-ins/{ci['id']}/complete/")
    assert done.status_code == 200
    body = done.json()
    assert body["status"] == "completed"
    assert body["completed_at"] is not None
    assert body["is_locked"] is True
    assert AuditLog.objects.filter(action="checkin.completed").exists()

    # Editar concluído é bloqueado (code locked).
    blocked = atendente_client.patch(
        f"/api/check-ins/{ci['id']}/",
        data={"mileage": 1},
        content_type="application/json",
    )
    assert blocked.status_code == 400
    assert blocked.json().get("code") == "locked"

    # Atendente não tem reopen; superuser reabre.
    assert (
        atendente_client.post(f"/api/check-ins/{ci['id']}/reopen/").status_code == 403
    )
    reopened = super_client.post(f"/api/check-ins/{ci['id']}/reopen/")
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "in_progress"


def test_complete_empty_requires_confirm(atendente_client, order):
    ci = _check_in(order, atendente_client)
    resp = atendente_client.post(f"/api/check-ins/{ci['id']}/complete/")
    assert resp.status_code == 400
    assert resp.json().get("code") == "empty"


def test_tecnico_can_edit_but_not_complete(tecnico_client, order):
    ci = _check_in(order, tecnico_client)
    assert (
        tecnico_client.post(
            "/api/check-in-damages/",
            data={
                "check_in": ci["id"],
                "x": "1",
                "y": "1",
                "severity": "light",
                "description": "z",
            },
            content_type="application/json",
        ).status_code
        == 201
    )
    assert (
        tecnico_client.post(f"/api/check-ins/{ci['id']}/complete/").status_code == 403
    )
