import pytest
from django.test import Client

from apps.quotes.services import create_quote_from_order

pytestmark = pytest.mark.django_db


def _create(auth_client, order):
    return auth_client.post(
        "/api/quotes/",
        data={"work_order": order.id},
        content_type="application/json",
    ).json()


def _service_item(quote_body):
    return next(i for i in quote_body["items"] if i["kind"] == "service")


def _part_item(quote_body):
    return next(i for i in quote_body["items"] if i["kind"] == "part")


def test_partial_approval_physical(auth_client, work_order):
    quote = _create(auth_client, work_order)
    service = _service_item(quote)  # R$ 100
    response = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partially_approved"
    assert body["status_display"] == "Aprovado parcialmente"

    statuses = {i["kind"]: i["status"] for i in body["items"]}
    assert statuses["service"] == "approved"
    assert statuses["part"] == "rejected"

    totals = body["totals"]
    assert totals["total_quoted"] == "200.00"
    assert totals["total_approved"] == "100.00"
    assert totals["total_rejected"] == "100.00"
    # Apenas o item aprovado compõe o valor final.
    assert totals["final_value"] == "100.00"

    # A OS avança mesmo na aprovação parcial.
    work_order.refresh_from_db()
    assert work_order.status == "approved"


def test_full_approval_when_all_items_selected(auth_client, work_order):
    quote = _create(auth_client, work_order)
    ids = [i["id"] for i in quote["items"]]
    body = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": ids},
        content_type="application/json",
    ).json()
    assert body["status"] == "approved"
    assert body["totals"]["total_approved"] == "200.00"
    assert body["totals"]["total_rejected"] == "0.00"


def test_reject_all_via_empty_selection(auth_client, work_order):
    quote = _create(auth_client, work_order)
    body = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": []},
        content_type="application/json",
    ).json()
    assert body["status"] == "rejected"
    assert body["totals"]["total_approved"] == "0.00"
    # OS não avança quando tudo é recusado.
    work_order.refresh_from_db()
    assert work_order.status == "awaiting_approval"


def test_public_partial_approval_records_item_decisions(work_order, user):
    quote = create_quote_from_order(work_order, user=user)
    quote.status = "sent"
    quote.save()
    service = quote.items.get(kind="service")

    anon = Client()
    response = anon.post(
        f"/api/public/quotes/{quote.public_token}/approve/",
        data={
            "client_name": "Maria Silva",
            "terms_accepted": True,
            "approved_item_ids": [service.id],
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partially_approved"
    assert body["totals"]["total_approved"] == "100.00"
    assert body["can_decide"] is False

    quote.refresh_from_db()
    assert quote.items.get(kind="service").status == "approved"
    assert quote.items.get(kind="part").status == "rejected"
    work_order.refresh_from_db()
    assert work_order.status == "approved"


def test_partially_approved_is_terminal(auth_client, work_order):
    quote = _create(auth_client, work_order)
    service = _service_item(quote)
    auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    )
    # Nova decisão é bloqueada (409) -- exige nova versão.
    again = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    )
    assert again.status_code == 409


def test_pdf_reflects_partial_approval(auth_client, work_order):
    quote = _create(auth_client, work_order)
    service = _service_item(quote)
    auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    )
    response = auth_client.get(f"/api/quotes/{quote['id']}/pdf/")
    assert response.status_code == 200
    assert response.content[:4] == b"%PDF"
