import pytest

pytestmark = pytest.mark.django_db


def _payload(customer, vehicle, linked_index):
    return {
        "customer": customer.id,
        "vehicle": vehicle.id,
        "opened_at": "2026-07-04",
        "customer_report": "Freio",
        "service_items": [
            {
                "service": None,
                "description": "Troca de pastilhas",
                "quantity": "1",
                "unit_price": "100.00",
            }
        ],
        "part_items": [
            {
                "part": None,
                "description": "Pastilha avulsa",
                "quantity": "2",
                "unit_price": "50.00",
                "linked_service_index": linked_index,
            }
        ],
    }


def test_avulso_part_can_be_linked_to_an_avulso_service(auth_client, customer, vehicle):
    # Vincula a peça avulsa ao serviço avulso pelo índice 0.
    create = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, 0),
        content_type="application/json",
    )
    assert create.status_code == 201
    order_id = create.json()["id"]

    body = auth_client.get(f"/api/work-orders/{order_id}/").json()
    part = body["part_items"][0]
    assert part["linked_service_index"] == 0
    assert part["is_custom"] is True  # peça avulsa


def test_link_is_cleared_when_index_is_null(auth_client, customer, vehicle):
    create = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, None),
        content_type="application/json",
    )
    order_id = create.json()["id"]
    body = auth_client.get(f"/api/work-orders/{order_id}/").json()
    assert body["part_items"][0]["linked_service_index"] is None


def test_link_survives_an_update(auth_client, customer, vehicle):
    order_id = auth_client.post(
        "/api/work-orders/",
        data=_payload(customer, vehicle, 0),
        content_type="application/json",
    ).json()["id"]
    # Reenvia (replace-all) mantendo o vínculo -- o índice é a chave estável.
    auth_client.patch(
        f"/api/work-orders/{order_id}/",
        data={
            "service_items": _payload(customer, vehicle, 0)["service_items"],
            "part_items": _payload(customer, vehicle, 0)["part_items"],
        },
        content_type="application/json",
    )
    body = auth_client.get(f"/api/work-orders/{order_id}/").json()
    assert body["part_items"][0]["linked_service_index"] == 0
