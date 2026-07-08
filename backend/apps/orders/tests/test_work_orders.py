import pytest

from apps.orders.models import WorkOrder

pytestmark = pytest.mark.django_db


def _payload(customer, vehicle, **overrides):
    data = {
        "customer": customer.id,
        "vehicle": vehicle.id,
        "opened_at": "2026-07-04",
        "customer_report": "Barulho ao frear",
    }
    data.update(overrides)
    return data


def test_requires_authentication(client, customer, vehicle):
    response = client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    assert response.status_code in (401, 403)


def test_create_minimal_work_order(auth_client, customer, vehicle):
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["number"] == 1
    assert body["status"] == "open"
    assert body["customer_name"] == "Maria Silva"
    assert body["customer_whatsapp"] == "11987654321"
    assert body["vehicle_plate"] == "ABC1234"
    assert body["gross_total"] == "0.00"
    assert body["final_value"] == "0.00"


def test_numbers_are_sequential(auth_client, customer, vehicle):
    first = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    second = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    assert second["number"] == first["number"] + 1


def test_customer_report_is_required(auth_client, customer, vehicle):
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, customer_report="   "),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "customer_report" in response.json()


def test_vehicle_must_belong_to_customer(auth_client, other_customer, vehicle):
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(other_customer, vehicle),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "vehicle" in response.json()


def test_cannot_assign_disabled_vehicle_on_create(auth_client, customer, vehicle):
    vehicle.is_active = False
    vehicle.save(update_fields=["is_active"])
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "vehicle" in response.json()


def test_update_keeps_disabled_vehicle(auth_client, customer, vehicle):
    order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    # Vehicle gets disabled after the OS was created.
    from apps.vehicles.models import Vehicle

    Vehicle.objects.filter(id=vehicle.id).update(is_active=False)
    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={"diagnosis": "Pastilha gasta"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["diagnosis"] == "Pastilha gasta"


def test_customer_and_vehicle_are_immutable_after_creation(
    auth_client, customer, vehicle, other_customer
):
    from apps.vehicles.models import Vehicle

    order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()

    # Try to reassign to a different customer + their vehicle on update.
    other_vehicle = Vehicle.objects.create(
        customer=other_customer, license_plate="ZZZ9999"
    )
    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={
            "customer": other_customer.id,
            "vehicle": other_vehicle.id,
            "diagnosis": "x",
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    # Vehicle/customer stay put (read-only on update); other fields still apply.
    assert body["customer"] == customer.id
    assert body["vehicle"] == vehicle.id
    assert body["diagnosis"] == "x"


def test_status_cannot_be_changed_by_regular_update(auth_client, customer, vehicle):
    order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={"status": "in_progress"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "status" in response.json()
    assert WorkOrder.objects.get(id=order["id"]).status == "open"


def test_soft_delete_and_reactivate(auth_client, customer, vehicle):
    order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    oid = order["id"]

    delete = auth_client.delete(f"/api/work-orders/{oid}/")
    assert delete.status_code == 204
    assert WorkOrder.objects.get(id=oid).is_active is False

    # Hidden from the default listing, visible under the inactive filter.
    assert auth_client.get("/api/work-orders/").json() == []
    inactive = auth_client.get("/api/work-orders/?active=inactive").json()
    assert len(inactive) == 1

    reactivate = auth_client.post(f"/api/work-orders/{oid}/reactivate/")
    assert reactivate.status_code == 200
    assert WorkOrder.objects.get(id=oid).is_active is True


def test_status_filter(auth_client, customer, vehicle):
    open_os = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    WorkOrder.objects.filter(id=open_os["id"]).update(status="finished")
    auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    finished = auth_client.get("/api/work-orders/?status=finished").json()
    assert len(finished) == 1
    assert finished[0]["status"] == "finished"


def test_search_by_plate_and_customer(auth_client, customer, vehicle):
    auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    assert len(auth_client.get("/api/work-orders/?search=ABC1234").json()) == 1
    assert len(auth_client.get("/api/work-orders/?search=Maria").json()) == 1
    assert len(auth_client.get("/api/work-orders/?search=Zzz").json()) == 0


def test_search_by_number(auth_client, customer, vehicle):
    created = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    ).json()
    results = auth_client.get(f"/api/work-orders/?search={created['number']}").json()
    assert len(results) == 1
    assert results[0]["number"] == created["number"]


def test_expected_delivery_auto_filled_from_default_deadline(
    auth_client, customer, vehicle
):
    from apps.workshop.models import OrderSettings

    OrderSettings.get_solo()  # seeds the default (7 days)
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, opened_at="2026-08-01"),
        content_type="application/json",
    )
    assert response.status_code == 201
    # 2026-08-01 + 7 dias = 2026-08-08.
    assert response.json()["expected_delivery"] == "2026-08-08"


def test_explicit_expected_delivery_is_respected(auth_client, customer, vehicle):
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(
            customer, vehicle, opened_at="2026-08-01", expected_delivery="2026-08-03"
        ),
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["expected_delivery"] == "2026-08-03"


def test_changing_default_deadline_does_not_touch_existing_os(
    auth_client, customer, vehicle
):
    from apps.workshop.models import OrderSettings

    order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, opened_at="2026-08-01"),
        content_type="application/json",
    ).json()
    assert order["expected_delivery"] == "2026-08-08"

    settings = OrderSettings.get_solo()
    settings.default_delivery_days = 30
    settings.save()

    # The existing OS keeps its original expected delivery.
    refreshed = auth_client.get(f"/api/work-orders/{order['id']}/").json()
    assert refreshed["expected_delivery"] == "2026-08-08"

    # A new OS uses the new default.
    new_order = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, opened_at="2026-08-01"),
        content_type="application/json",
    ).json()
    assert new_order["expected_delivery"] == "2026-08-31"


def test_board_operational_excludes_finished_and_canceled(
    auth_client, customer, vehicle
):
    def make(status):
        order = auth_client.post(
            "/api/work-orders/",
            data=_payload(customer, vehicle),
            content_type="application/json",
        ).json()
        if status != "open":
            WorkOrder.objects.filter(id=order["id"]).update(status=status)

    for st in ("open", "in_progress", "finished", "canceled"):
        make(st)

    board = auth_client.get("/api/work-orders/?board=operational").json()
    assert len(board) == 2
    assert {o["status"] for o in board} == {"open", "in_progress"}


def test_period_today_filter(auth_client, customer, vehicle):
    from django.utils import timezone

    today = timezone.localdate().isoformat()
    auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, opened_at=today),
        content_type="application/json",
    )
    auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, opened_at="2020-01-01"),
        content_type="application/json",
    )
    results = auth_client.get("/api/work-orders/?period=today").json()
    assert len(results) == 1
    assert results[0]["opened_at"] == today


def test_filter_by_customer(auth_client, customer, vehicle, other_customer):
    auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle),
        content_type="application/json",
    )
    assert len(auth_client.get(f"/api/work-orders/?customer={customer.id}").json()) == 1
    assert (
        len(auth_client.get(f"/api/work-orders/?customer={other_customer.id}").json())
        == 0
    )
