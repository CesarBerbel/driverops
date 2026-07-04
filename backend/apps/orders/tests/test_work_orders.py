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


def test_status_can_be_updated(auth_client, customer, vehicle):
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
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"
    assert response.json()["status_display"] == "Em execução"


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
    auth_client.patch(
        f"/api/work-orders/{open_os['id']}/",
        data={"status": "finished"},
        content_type="application/json",
    )
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
