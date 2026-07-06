"""Atribuição de técnico responsável à OS + listagem de técnicos."""

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.models import Role
from apps.orders.models import WorkOrder

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def technician(db):
    u = User.objects.create_user(
        email="tecnico@example.com", password="StrongPass123", full_name="Zé Técnico"
    )
    u.role = Role.objects.filter(key="tecnico").first()
    u.technical_specialty = "mechanic"
    u.save(update_fields=["role", "technical_specialty"])
    return u


def _payload(customer, vehicle, **extra):
    return {
        "customer": customer.id,
        "vehicle": vehicle.id,
        "opened_at": "2026-07-04",
        "customer_report": "Revisão",
        **extra,
    }


def test_technicians_endpoint_lists_active_technicians(auth_client, technician):
    response = auth_client.get("/api/work-orders/technicians/")
    assert response.status_code == 200
    rows = response.json()
    ids = {r["id"] for r in rows}
    assert technician.id in ids
    row = next(r for r in rows if r["id"] == technician.id)
    assert row["name"] == "Zé Técnico"
    assert row["technical_specialty_display"] == "Mecânico"


def test_technicians_excludes_inactive(auth_client, technician):
    technician.is_active = False
    technician.save(update_fields=["is_active"])
    response = auth_client.get("/api/work-orders/technicians/")
    ids = {r["id"] for r in response.json()}
    assert technician.id not in ids


def test_assign_technician_on_create(auth_client, customer, vehicle, technician):
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, assigned_technician=technician.id),
        content_type="application/json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["assigned_technician"] == technician.id
    assert body["assigned_technician_name"] == "Zé Técnico"


def test_assign_technician_on_update(auth_client, customer, vehicle, technician):
    order = WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="x"
    )
    response = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"assigned_technician": technician.id},
        content_type="application/json",
    )
    assert response.status_code == 200
    order.refresh_from_db()
    assert order.assigned_technician_id == technician.id


def test_inactive_technician_rejected_on_new_assignment(
    auth_client, customer, vehicle, technician
):
    technician.is_active = False
    technician.save(update_fields=["is_active"])
    response = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, assigned_technician=technician.id),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "assigned_technician" in response.json()


def test_keeping_deactivated_technician_on_update_is_allowed(
    auth_client, customer, vehicle, technician
):
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        assigned_technician=technician,
    )
    technician.is_active = False
    technician.save(update_fields=["is_active"])
    # Editar outro campo mantendo o técnico já atribuído (agora inativo) deve passar.
    response = auth_client.patch(
        f"/api/work-orders/{order.id}/",
        data={"internal_notes": "segue com o mesmo técnico"},
        content_type="application/json",
    )
    assert response.status_code == 200


def test_filter_orders_by_technician(auth_client, customer, vehicle, technician):
    assigned = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="x",
        assigned_technician=technician,
    )
    WorkOrder.objects.create(
        customer=customer, vehicle=vehicle, opened_at="2026-07-04", customer_report="y"
    )
    response = auth_client.get(f"/api/work-orders/?technician={technician.id}")
    assert response.status_code == 200
    ids = {r["id"] for r in response.json()}
    assert ids == {assigned.id}
