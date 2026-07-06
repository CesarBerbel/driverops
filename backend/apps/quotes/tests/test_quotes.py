import pytest
from django.core import mail

from apps.orders.models import OrderEvent
from apps.quotes.models import Quote

pytestmark = pytest.mark.django_db


def _create(auth_client, order):
    return auth_client.post(
        "/api/quotes/",
        data={"work_order": order.id},
        content_type="application/json",
    )


# --- criação / snapshot / totais ---


def test_requires_authentication(client, work_order):
    response = client.post(
        "/api/quotes/",
        data={"work_order": work_order.id},
        content_type="application/json",
    )
    assert response.status_code in (401, 403)


def test_create_snapshots_items_and_totals(auth_client, work_order):
    response = _create(auth_client, work_order)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert body["version"] == 1
    assert len(body["items"]) == 2
    assert body["totals"]["services_total"] == "100.00"
    assert body["totals"]["parts_total"] == "100.00"
    assert body["totals"]["gross_total"] == "200.00"
    assert body["totals"]["final_value"] == "200.00"
    # snapshot preserva se é avulso
    assert all(item["is_custom"] for item in body["items"])


def test_snapshot_is_frozen_when_os_changes(auth_client, work_order):
    quote_id = _create(auth_client, work_order).json()["id"]
    # Muda a OS depois de gerar o orçamento.
    work_order.part_items.all().delete()
    work_order.customer_report = "Outro relato"
    work_order.save()

    body = auth_client.get(f"/api/quotes/{quote_id}/").json()
    assert len(body["items"]) == 2  # inalterado
    assert body["customer_report"] == "Barulho ao frear"


def test_second_quote_is_a_new_version(auth_client, work_order):
    first = _create(auth_client, work_order).json()
    second = _create(auth_client, work_order).json()
    assert first["version"] == 1
    assert second["version"] == 2
    assert second["number"] == first["number"] + 1


# --- envio por e-mail ---


def test_send_sets_status_and_emails_link(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    response = auth_client.post(f"/api/quotes/{quote['id']}/send/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "sent"
    assert body["sent_to_email"] == "maria@example.com"
    assert len(mail.outbox) == 1
    assert body["public_token"] in mail.outbox[0].body


def test_send_requires_an_email(auth_client, work_order):
    work_order.customer.email = ""
    work_order.customer.save()
    quote = _create(auth_client, work_order).json()
    response = auth_client.post(f"/api/quotes/{quote['id']}/send/")
    assert response.status_code == 400


# --- aprovação presencial ---


def test_approve_physical_advances_the_os(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    response = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        data={"note": "Assinado no balcão"},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["approval_channel"] == "physical"
    assert body["client_name"] == "Maria Silva"
    work_order.refresh_from_db()
    assert work_order.status == "approved"


def test_quote_lifecycle_records_os_events(auth_client, work_order):
    # Criar -> enviar -> aprovar registra eventos na timeline da OS.
    quote = _create(auth_client, work_order).json()
    auth_client.post(f"/api/quotes/{quote['id']}/send/")
    auth_client.post(
        f"/api/quotes/{quote['id']}/approve-physical/",
        content_type="application/json",
    )
    types = set(
        OrderEvent.objects.filter(order=work_order).values_list("event_type", flat=True)
    )
    assert OrderEvent.Type.QUOTE_CREATED in types
    assert OrderEvent.Type.QUOTE_SENT in types
    assert OrderEvent.Type.QUOTE_APPROVED in types


def test_approve_tablet_requires_signature(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    response = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-tablet/",
        data={"client_name": "Maria Silva"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_approve_tablet_saves_signature(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    # 1x1 PNG transparente em base64.
    png = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    response = auth_client.post(
        f"/api/quotes/{quote['id']}/approve-tablet/",
        data={"client_name": "Maria Silva", "signature": png},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["approval_channel"] == "tablet"
    assert body["signature_image"]


def test_approved_quote_is_locked(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    auth_client.post(f"/api/quotes/{quote['id']}/approve-physical/")
    # Segunda decisão é bloqueada (409).
    again = auth_client.post(f"/api/quotes/{quote['id']}/approve-physical/")
    assert again.status_code == 409


def test_reject_internal(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    response = auth_client.post(
        f"/api/quotes/{quote['id']}/reject/",
        data={"reason": "Cliente desistiu"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


# --- cancelamento (soft) / listagem ---


def test_cancel_and_soft_delete(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    cancel = auth_client.post(f"/api/quotes/{quote['id']}/cancel/")
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "canceled"

    # Soft delete some da listagem, mas não é apagado fisicamente.
    auth_client.delete(f"/api/quotes/{quote['id']}/")
    listing = auth_client.get(f"/api/quotes/?work_order={work_order.id}").json()
    assert all(q["id"] != quote["id"] for q in listing)
    assert Quote.objects.filter(id=quote["id"]).exists()


def test_list_filters_by_work_order(auth_client, work_order):
    _create(auth_client, work_order)
    response = auth_client.get(f"/api/quotes/?work_order={work_order.id}")
    assert response.status_code == 200
    assert len(response.json()) == 1


# --- PDF ---


def test_pdf_generation(auth_client, work_order):
    quote = _create(auth_client, work_order).json()
    response = auth_client.get(f"/api/quotes/{quote['id']}/pdf/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"
