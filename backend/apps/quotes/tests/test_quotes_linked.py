import pytest

from apps.quotes.services import create_quote_from_order

pytestmark = pytest.mark.django_db


def _create(auth_client, order):
    return auth_client.post(
        "/api/quotes/",
        data={"work_order": order.id},
        content_type="application/json",
    ).json()


def _by_desc(items, text):
    return next(i for i in items if i["description"] == text)


def test_standard_part_is_linked_to_its_service(auth_client, linked_work_order):
    body = _create(auth_client, linked_work_order)
    service = _by_desc(body["items"], "Troca de pastilhas")
    pad = _by_desc(body["items"], "Pastilha dianteira")
    fluid = _by_desc(body["items"], "Fluido de freio")

    assert pad["linked_service"] == service["id"]  # peça padrão vinculada
    assert fluid["linked_service"] is None  # peça avulsa independente
    assert service["linked_service"] is None


def test_linked_part_follows_service_when_service_rejected(
    auth_client, linked_work_order
):
    body = _create(auth_client, linked_work_order)
    fluid = _by_desc(body["items"], "Fluido de freio")
    pad = _by_desc(body["items"], "Pastilha dianteira")
    # O cliente tenta aprovar a peça vinculada sem o serviço (só a peça + avulsa).
    approved = auth_client.post(
        f"/api/quotes/{body['id']}/approve-physical/",
        data={"approved_item_ids": [pad["id"], fluid["id"]]},
        content_type="application/json",
    ).json()

    statuses = {i["description"]: i["status"] for i in approved["items"]}
    # A peça vinculada é recusada junto com o serviço, apesar de ter sido marcada.
    assert statuses["Troca de pastilhas"] == "rejected"
    assert statuses["Pastilha dianteira"] == "rejected"
    # A peça avulsa segue a própria seleção.
    assert statuses["Fluido de freio"] == "approved"
    assert approved["status"] == "partially_approved"


def test_linked_part_approved_with_service(auth_client, linked_work_order):
    body = _create(auth_client, linked_work_order)
    service = _by_desc(body["items"], "Troca de pastilhas")
    # Aprova só o serviço (sem marcar a peça vinculada explicitamente).
    approved = auth_client.post(
        f"/api/quotes/{body['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    ).json()

    statuses = {i["description"]: i["status"] for i in approved["items"]}
    # A peça vinculada é aprovada junto com o serviço.
    assert statuses["Troca de pastilhas"] == "approved"
    assert statuses["Pastilha dianteira"] == "approved"
    assert statuses["Fluido de freio"] == "rejected"


def test_manual_avulso_link_flows_into_the_quote(auth_client, customer, vehicle):
    # OS com serviço avulso + peça avulsa vinculada manualmente (índice 0).
    order_id = auth_client.post(
        "/api/work-orders/",
        data={
            "customer": customer.id,
            "vehicle": vehicle.id,
            "opened_at": "2026-07-04",
            "customer_report": "Freio",
            "service_items": [
                {
                    "service": None,
                    "description": "Serviço avulso",
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
            "part_items": [
                {
                    "part": None,
                    "description": "Peça avulsa",
                    "quantity": "1",
                    "unit_price": "40.00",
                    "linked_service_index": 0,
                }
            ],
        },
        content_type="application/json",
    ).json()["id"]

    body = auth_client.post(
        "/api/quotes/",
        data={"work_order": order_id},
        content_type="application/json",
    ).json()
    service = _by_desc(body["items"], "Serviço avulso")
    part = _by_desc(body["items"], "Peça avulsa")
    # A peça avulsa fica vinculada ao serviço no orçamento (mesmo sem catálogo).
    assert part["linked_service"] == service["id"]


def test_public_partial_respects_link(linked_work_order, user):
    quote = create_quote_from_order(linked_work_order, user=user)
    quote.status = "sent"
    quote.save()
    service = quote.items.get(description="Troca de pastilhas")
    pad = quote.items.get(description="Pastilha dianteira")

    from django.test import Client

    anon = Client()
    # Marca a peça vinculada, mas não o serviço -> ambos recusados.
    anon.post(
        f"/api/public/quotes/{quote.public_token}/approve/",
        data={
            "client_name": "Maria",
            "terms_accepted": True,
            "approved_item_ids": [pad.id],
        },
        content_type="application/json",
    )
    quote.refresh_from_db()
    assert quote.items.get(id=service.id).status == "rejected"
    assert quote.items.get(id=pad.id).status == "rejected"
