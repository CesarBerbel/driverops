import pytest

pytestmark = pytest.mark.django_db


def _base(customer, vehicle, **overrides):
    data = {
        "customer": customer.id,
        "vehicle": vehicle.id,
        "opened_at": "2026-07-04",
        "customer_report": "Revisão geral",
    }
    data.update(overrides)
    return data


def test_totals_across_services_packages_and_parts(
    auth_client, customer, vehicle, service, package, part
):
    payload = _base(
        customer,
        vehicle,
        service_items=[
            {
                "service": service.id,
                "description": service.name,
                "quantity": "2",
                "unit_price": "100.00",
            },
            {
                "service": None,
                "description": "Solda avulsa",
                "quantity": "1",
                "unit_price": "50.00",
            },
        ],
        package_items=[
            {
                "package": package.id,
                "description": package.name,
                "quantity": "1",
                "unit_price": "80.00",
            }
        ],
        part_items=[
            {
                "part": part.id,
                "description": part.name,
                "quantity": "3",
                "unit_price": "10.00",
            }
        ],
    )
    response = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    )
    assert response.status_code == 201
    body = response.json()
    assert body["services_total"] == "250.00"  # 2*100 + 50
    assert body["packages_total"] == "80.00"
    assert body["parts_total"] == "30.00"  # 3*10
    assert body["gross_total"] == "360.00"
    assert body["final_value"] == "360.00"


def test_percent_discount(auth_client, customer, vehicle):
    payload = _base(
        customer,
        vehicle,
        service_items=[
            {
                "service": None,
                "description": "Item",
                "quantity": "1",
                "unit_price": "200.00",
            }
        ],
        discount_type="percent",
        discount_value="10",
    )
    body = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    ).json()
    assert body["gross_total"] == "200.00"
    assert body["final_value"] == "180.00"


def test_fixed_discount_clamps_at_zero(auth_client, customer, vehicle):
    payload = _base(
        customer,
        vehicle,
        service_items=[
            {
                "service": None,
                "description": "Item",
                "quantity": "1",
                "unit_price": "50.00",
            }
        ],
        discount_type="fixed",
        discount_value="80.00",
    )
    body = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    ).json()
    assert body["final_value"] == "0.00"


def test_percent_discount_out_of_range_rejected(auth_client, customer, vehicle):
    payload = _base(customer, vehicle, discount_type="percent", discount_value="150")
    response = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert "discount_value" in response.json()


def test_avulso_item_requires_description(auth_client, customer, vehicle):
    payload = _base(
        customer,
        vehicle,
        part_items=[{"part": None, "quantity": "1", "unit_price": "10.00"}],
    )
    response = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert "part_items" in response.json()


def test_negative_quantity_rejected(auth_client, customer, vehicle, service):
    payload = _base(
        customer,
        vehicle,
        service_items=[
            {
                "service": service.id,
                "description": service.name,
                "quantity": "-1",
                "unit_price": "10.00",
            }
        ],
    )
    response = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    )
    assert response.status_code == 400


def test_is_custom_flag_and_display_name(auth_client, customer, vehicle, service):
    payload = _base(
        customer,
        vehicle,
        service_items=[
            {"service": service.id, "quantity": "1", "unit_price": "100.00"},
            {
                "service": None,
                "description": "Avulso",
                "quantity": "1",
                "unit_price": "10.00",
            },
        ],
    )
    body = auth_client.post(
        "/api/work-orders/", data=payload, content_type="application/json"
    ).json()
    cadastrado, avulso = body["service_items"]
    assert cadastrado["is_custom"] is False
    # display_name falls back to the linked service name when no description sent.
    assert cadastrado["display_name"] == "Troca de óleo"
    assert avulso["is_custom"] is True
    assert avulso["display_name"] == "Avulso"


def test_update_replaces_line_items(auth_client, customer, vehicle, service):
    order = auth_client.post(
        "/api/work-orders/",
        data=_base(
            customer,
            vehicle,
            service_items=[
                {
                    "service": service.id,
                    "description": service.name,
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
        ),
        content_type="application/json",
    ).json()

    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={
            "service_items": [
                {
                    "service": None,
                    "description": "Novo item",
                    "quantity": "2",
                    "unit_price": "25.00",
                }
            ]
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["service_items"]) == 1
    assert body["service_items"][0]["display_name"] == "Novo item"
    assert body["services_total"] == "50.00"


def test_linked_service_survives_disable_on_read(
    auth_client, customer, vehicle, service
):
    """A cadastrado line keeps working (snapshot) after the service is disabled."""
    order = auth_client.post(
        "/api/work-orders/",
        data=_base(
            customer,
            vehicle,
            service_items=[
                {
                    "service": service.id,
                    "description": service.name,
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
        ),
        content_type="application/json",
    ).json()
    service.is_active = False
    service.save(update_fields=["is_active"])

    body = auth_client.get(f"/api/work-orders/{order['id']}/").json()
    assert body["service_items"][0]["display_name"] == "Troca de óleo"
    assert body["services_total"] == "100.00"


@pytest.mark.parametrize("quote_status", ["approved", "partially_approved"])
def test_approved_or_partially_approved_quote_locks_order_line_items(
    auth_client, customer, vehicle, service, quote_status
):
    from apps.quotes.models import Quote

    order = auth_client.post(
        "/api/work-orders/",
        data=_base(
            customer,
            vehicle,
            service_items=[
                {
                    "service": service.id,
                    "description": service.name,
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
        ),
        content_type="application/json",
    ).json()
    Quote.objects.create(work_order_id=order["id"], status=quote_status)

    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={
            "service_items": [
                {
                    "service": None,
                    "description": "Novo item",
                    "quantity": "2",
                    "unit_price": "25.00",
                }
            ]
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "items" in response.json()
    body = auth_client.get(f"/api/work-orders/{order['id']}/").json()
    assert len(body["service_items"]) == 1
    assert body["service_items"][0]["display_name"] == "Troca de óleo"
    assert body["services_total"] == "100.00"


def test_rejected_quote_does_not_lock_order_line_items(
    auth_client, customer, vehicle, service
):
    from apps.quotes.models import Quote

    order = auth_client.post(
        "/api/work-orders/",
        data=_base(
            customer,
            vehicle,
            service_items=[
                {
                    "service": service.id,
                    "description": service.name,
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
        ),
        content_type="application/json",
    ).json()
    Quote.objects.create(work_order_id=order["id"], status="rejected")

    response = auth_client.patch(
        f"/api/work-orders/{order['id']}/",
        data={
            "service_items": [
                {
                    "service": None,
                    "description": "Novo item",
                    "quantity": "2",
                    "unit_price": "25.00",
                }
            ]
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["service_items"][0]["display_name"] == "Novo item"
