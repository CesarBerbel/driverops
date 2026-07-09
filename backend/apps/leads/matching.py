"""Identificação de cliente/veículo existentes e verificação do vínculo.

Ao receber um pedido do site, o sistema tenta identificar automaticamente se o
cliente e o veículo já existem, e se o veículo pertence ao cliente informado —
apontando divergências (ex.: veículo cadastrado em outro cliente) sem impedir o
atendimento. A decisão final é sempre do usuário autorizado.
"""

import re

from django.db.models import Q

from apps.customers.models import Customer
from apps.customers.utils import only_digits
from apps.vehicles.models import Vehicle


def normalize_plate(value):
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())[:7]


def _customer_brief(c):
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "whatsapp": c.whatsapp,
        "email": c.email,
        "document": c.document,
    }


def match_customer(*, name="", phone="", email="", document=""):
    """Identifica o cliente. Devolve confidence + candidato(s).

    confidence: ``high`` (telefone/documento batem), ``possible`` (e-mail/nome),
    ``conflict`` (mais de um cliente forte diferente) ou ``new`` (nenhum).
    """
    phone = only_digits(phone)
    document = only_digits(document)
    email = (email or "").strip().lower()

    strong = Customer.objects.none()
    filters = Q()
    if phone:
        filters |= Q(phone=phone) | Q(whatsapp=phone)
    if document:
        filters |= Q(document=document)
    if filters:
        strong = Customer.objects.filter(filters).distinct()

    weak_ids = set()
    if email:
        weak_ids |= set(
            Customer.objects.filter(email__iexact=email).values_list("id", flat=True)
        )
    if name and len(name.strip()) >= 4:
        weak_ids |= set(
            Customer.objects.filter(name__icontains=name.strip()).values_list(
                "id", flat=True
            )[:5]
        )

    strong_list = list(strong[:5])
    if len(strong_list) == 1:
        confidence = "high"
        candidate = strong_list[0]
    elif len(strong_list) > 1:
        confidence = "conflict"
        candidate = None
    elif weak_ids:
        confidence = "possible"
        candidate = Customer.objects.filter(id__in=weak_ids).first()
    else:
        confidence = "new"
        candidate = None

    candidate_ids = {c.id for c in strong_list} | weak_ids
    candidates = Customer.objects.filter(id__in=candidate_ids)[:8]
    return {
        "confidence": confidence,
        "customer": _customer_brief(candidate) if candidate else None,
        "candidates": [_customer_brief(c) for c in candidates],
    }


def match_vehicle(*, plate=""):
    """Identifica o veículo pela placa. Indica o cliente dono, se houver."""
    plate = normalize_plate(plate)
    if not plate:
        return {"found": False, "vehicle": None, "owner": None}
    vehicle = (
        Vehicle.objects.select_related("customer")
        .filter(license_plate=plate)
        .first()
    )
    if vehicle is None:
        return {"found": False, "vehicle": None, "owner": None}
    return {
        "found": True,
        "vehicle": {
            "id": vehicle.id,
            "license_plate": vehicle.license_plate,
            "brand": vehicle.brand,
            "model": vehicle.model,
            "year": vehicle.model_year or vehicle.manufacture_year,
        },
        "owner": _customer_brief(vehicle.customer),
    }


def analyze_lead(lead):
    """Análise consolidada de cliente, veículo e vínculo, para a tela do pedido."""
    customer = match_customer(
        name=lead.name, phone=lead.phone, email=lead.email, document=lead.document
    )
    vehicle = match_vehicle(plate=lead.vehicle_plate)

    # Cliente de referência para a verificação: o já vinculado tem prioridade.
    ref_customer_id = lead.linked_customer_id or (
        customer["customer"]["id"] if customer["customer"] else None
    )

    if not lead.vehicle_plate:
        verification = "vehicle_not_found"
    elif not vehicle["found"]:
        verification = "vehicle_not_found"
    elif ref_customer_id is None:
        verification = "customer_not_found"
    elif vehicle["owner"] and vehicle["owner"]["id"] == ref_customer_id:
        verification = "confirmed"
    elif vehicle["owner"]:
        verification = "divergent"
    else:
        verification = "inconclusive"

    divergent = verification == "divergent"
    return {
        "customer_match": customer,
        "vehicle_match": vehicle,
        "verification": verification,
        "vehicle_belongs_to_other_customer": divergent,
    }
