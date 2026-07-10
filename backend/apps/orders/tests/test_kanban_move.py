import pytest

from apps.accounts.models import Permission, UserPermission
from apps.orders.models import WorkOrder

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


def _move(client, order, status, reason=""):
    return client.post(
        f"/api/work-orders/{order.id}/move/",
        data={"status": status, "reason": reason},
        content_type="application/json",
    )


def test_move_requires_authentication(client, customer, vehicle):
    order = _order(customer, vehicle)
    response = _move(client, order, "diagnosing")
    assert response.status_code in (401, 403)


def test_valid_transition_updates_status(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    response = _move(auth_client, order, "diagnosing")
    assert response.status_code == 200
    assert response.json()["status"] == "diagnosing"
    order.refresh_from_db()
    assert order.status == "diagnosing"


def test_invalid_transition_is_rejected_and_status_unchanged(
    auth_client, customer, vehicle
):
    # open -> finished is not a valid Kanban transition.
    order = _order(customer, vehicle, status="open")
    response = _move(auth_client, order, "finished")
    assert response.status_code == 400
    assert "status" in response.json()
    order.refresh_from_db()
    assert order.status == "open"


def test_unknown_status_is_rejected(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    response = _move(auth_client, order, "banana")
    assert response.status_code == 400
    order.refresh_from_db()
    assert order.status == "open"


def test_cancel_requires_critical_permission(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="open")
    response = _move(auth_client, order, "canceled")
    assert response.status_code == 403
    order.refresh_from_db()
    assert order.status == "open"


def test_cancel_with_critical_permission(auth_client, user, customer, vehicle):
    _grant(user, "orders.cancel")
    order = _order(customer, vehicle, status="open")
    # Cancelar exige justificativa (transição crítica).
    assert _move(auth_client, order, "canceled").status_code == 400
    response = _move(auth_client, order, "canceled", reason="Cliente desistiu.")
    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == "canceled"


def test_finish_requires_critical_permission(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="ready")
    response = _move(auth_client, order, "finished")
    assert response.status_code == 403
    order.refresh_from_db()
    assert order.status == "ready"


def test_finish_with_critical_permission(auth_client, user, customer, vehicle):
    _grant(user, "orders.finish")
    order = _order(customer, vehicle, status="ready")
    response = _move(auth_client, order, "finished")
    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == "finished"


def test_terminal_status_cannot_move_via_kanban(auth_client, customer, vehicle):
    # Finalizada is terminal in the Kanban -- no drag-and-drop out of it.
    order = _order(customer, vehicle, status="finished")
    response = _move(auth_client, order, "ready")
    assert response.status_code == 400
    order.refresh_from_db()
    assert order.status == "finished"


def test_moving_to_same_status_is_a_noop(auth_client, customer, vehicle):
    order = _order(customer, vehicle, status="in_progress")
    response = _move(auth_client, order, "in_progress")
    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == "in_progress"


def test_full_happy_path_flow(auth_client, user, customer, vehicle):
    _grant(user, "orders.finish")
    order = _order(customer, vehicle, status="open")
    for target in [
        "diagnosing",
        "awaiting_approval",
        "approved",
        "in_progress",
        "ready",
        "finished",
    ]:
        response = _move(auth_client, order, target)
        assert response.status_code == 200, (target, response.json())
    order.refresh_from_db()
    assert order.status == "finished"


# --- list filters used by the Kanban ---


def test_status_filter_accepts_comma_separated_list(auth_client, customer, vehicle):
    _order(customer, vehicle, status="open")
    _order(customer, vehicle, status="in_progress")
    _order(customer, vehicle, status="finished")
    response = auth_client.get("/api/work-orders/?status=open,in_progress")
    assert response.status_code == 200
    statuses = {row["status"] for row in response.json()}
    assert statuses == {"open", "in_progress"}


def test_overdue_filter_returns_only_late_operational_orders(
    auth_client, customer, vehicle
):
    late = _order(customer, vehicle, status="in_progress")
    late.expected_delivery = "2020-01-01"
    late.save(update_fields=["expected_delivery"])
    # A late but finished OS must be excluded from the overdue view.
    late_finished = _order(customer, vehicle, status="finished")
    late_finished.expected_delivery = "2020-01-01"
    late_finished.save(update_fields=["expected_delivery"])
    on_time = _order(customer, vehicle, status="open")
    on_time.expected_delivery = "2099-01-01"
    on_time.save(update_fields=["expected_delivery"])

    response = auth_client.get("/api/work-orders/?overdue=true")
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert ids == {late.id}
