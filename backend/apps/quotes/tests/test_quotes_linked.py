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
    pad = _by_desc(body["items"], "Pastilha dianteira")
    # Peça padrão é obrigatória por padrão -> vai junto do serviço no payload.
    approved = auth_client.post(
        f"/api/quotes/{body['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"], pad["id"]]},
        content_type="application/json",
    ).json()

    statuses = {i["description"]: i["status"] for i in approved["items"]}
    assert statuses["Troca de pastilhas"] == "approved"
    assert statuses["Pastilha dianteira"] == "approved"
    assert statuses["Fluido de freio"] == "rejected"


def test_required_part_cannot_be_rejected_when_service_approved(
    auth_client, linked_work_order
):
    body = _create(auth_client, linked_work_order)
    service = _by_desc(body["items"], "Troca de pastilhas")
    # Aprova o serviço mas tenta recusar a peça obrigatória (omite do payload).
    resp = auth_client.post(
        f"/api/quotes/{body['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"]]},
        content_type="application/json",
    )
    assert resp.status_code == 400
    body_err = resp.json()
    assert body_err["code"] == "required_service_part_cannot_be_rejected"
    assert body_err["items"][0]["part_name"] == "Pastilha dianteira"


def test_optional_standard_part_can_be_rejected(auth_client, customer, vehicle, db):
    from apps.categories.models import Category
    from apps.orders.models import WorkOrder, WorkOrderPart, WorkOrderService
    from apps.parts.models import Part
    from apps.services.models import Service, ServicePart

    sc = Category.objects.create(category_type="service", name="Motor")
    pc = Category.objects.create(category_type="part", name="Filtros")
    oil = Part.objects.create(category=pc, name="Óleo do motor", sale_price="30.00")
    air = Part.objects.create(category=pc, name="Filtro de ar", sale_price="20.00")
    svc = Service.objects.create(name="Troca de óleo", category=sc, labor_cost="80.00")
    ServicePart.objects.create(service=svc, part=oil, is_required=True)
    ServicePart.objects.create(service=svc, part=air, is_required=False)
    order = WorkOrder.objects.create(
        customer=customer,
        vehicle=vehicle,
        opened_at="2026-07-04",
        customer_report="Revisão",
        status="awaiting_approval",
    )
    WorkOrderService.objects.create(order=order, service=svc, quantity=1, unit_price=80)
    WorkOrderPart.objects.create(order=order, part=oil, quantity=1, unit_price=30)
    WorkOrderPart.objects.create(order=order, part=air, quantity=1, unit_price=20)

    body = _create(auth_client, order)
    service = _by_desc(body["items"], "Troca de óleo")
    oil_item = _by_desc(body["items"], "Óleo do motor")
    air_item = _by_desc(body["items"], "Filtro de ar")
    # Campos expostos: origem e obrigatoriedade.
    assert (
        oil_item["part_source"] == "standard"
        and oil_item["requirement_display"] == "Obrigatória"
    )
    assert air_item["requirement_display"] == "Opcional"

    # Aprova serviço + peça obrigatória; recusa a opcional (omite do payload).
    approved = auth_client.post(
        f"/api/quotes/{body['id']}/approve-physical/",
        data={"approved_item_ids": [service["id"], oil_item["id"]]},
        content_type="application/json",
    ).json()
    statuses = {i["description"]: i["status"] for i in approved["items"]}
    assert statuses["Troca de óleo"] == "approved"
    assert statuses["Óleo do motor"] == "approved"
    assert statuses["Filtro de ar"] == "rejected"  # opcional pode ser recusada
    assert approved["status"] == "partially_approved"


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
