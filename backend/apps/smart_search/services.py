"""Execução SEGURA da Busca Inteligente.

A intenção interpretada (heurística + IA) é transformada aqui em consultas ORM
seguras. Nunca há SQL livre: só filtros ``icontains``/data/status via Django ORM,
sempre com allowlist de campos e respeitando as permissões do usuário. Cada
resultado carrega o MOTIVO (campo que casou) e um TRECHO, para o usuário confiar.
"""

import time

from django.db.models import Q
from django.utils import timezone

from apps.customers.models import Customer
from apps.financial.models import Payment
from apps.leads.models import SiteLead
from apps.orders.models import WorkOrder
from apps.vehicles.models import Vehicle

from .ai import enhance_intent
from .intent import deaccent, interpret
from .models import RecentSearch, SearchLog
from .semantic import semantic_work_order_scores

# Entidade -> permissão necessária para aparecer nos resultados.
ENTITY_PERMISSION = {
    "work_order": "orders.view",
    "customer": "customers.view",
    "vehicle": "vehicles.view",
    "lead": "leads.view",
    "financial": "financial.view",
}

# Entidades pesquisadas por padrão quando a pergunta não indica uma específica.
DEFAULT_ENTITIES = ("work_order", "customer", "vehicle", "lead")

_STATUS_LABELS = dict(WorkOrder.Status.choices)


def _can(user, code):
    return bool(user and user.has_perm_code(code))


def _can_see_internal(user, settings_obj):
    """Trechos de observações internas só para quem edita OS (staff elevado)."""
    return settings_obj.include_internal_notes and (
        user.is_superuser or user.has_perm_code("orders.edit")
    )


def _excerpt(text, needle, width=160):
    text = (text or "").strip()
    if not text:
        return ""
    idx = deaccent(text).find(deaccent(needle))
    if idx < 0:
        return text[:width] + ("…" if len(text) > width else "")
    start = max(0, idx - width // 3)
    end = min(len(text), idx + len(needle) + width // 2)
    snippet = text[start:end].strip()
    return ("…" if start > 0 else "") + snippet + ("…" if end < len(text) else "")


def _field_match(text, concepts):
    """Devolve a primeira variante de conceito presente no texto, ou None."""
    d = deaccent(text or "")
    if not d:
        return None
    for concept in concepts:
        for variant in concept["variants"]:
            if deaccent(variant) in d:
                return variant
    return None


def _concepts_q(fields, concepts):
    """OR de ``unaccent(campo) ILIKE valor`` -- busca insensível a acento/caixa.

    O ``unaccent`` remove acentos do lado do campo; passamos o valor já sem
    acento (deaccent) para que ambos os lados fiquem normalizados.
    """
    q = Q()
    seen = set()
    for concept in concepts:
        for variant in concept["variants"]:
            value = deaccent(variant)
            if value in seen:
                continue
            seen.add(value)
            for field in fields:
                q |= Q(**{f"{field}__unaccent__icontains": value})
    return q


def _score(blob, concepts):
    d = deaccent(blob)
    hits = 0
    for concept in concepts:
        if any(deaccent(v) in d for v in concept["variants"]):
            hits += 1
    return hits


# --------------------------------------------------------------------------- #
# Buscas por entidade
# --------------------------------------------------------------------------- #
def _search_work_orders(intent, *, user, settings_obj, semantic_scores=None):
    concepts = intent["concepts"]
    statuses = intent["statuses"]
    date_range = intent["date_range"]
    allow_internal = _can_see_internal(user, settings_obj)
    semantic_scores = semantic_scores or {}

    if not concepts and not statuses and not date_range and not semantic_scores:
        return []

    base = WorkOrder.objects.filter(is_active=True)
    if statuses:
        base = base.filter(status__in=statuses)
    if date_range:
        base = base.filter(
            opened_at__gte=date_range["start"], opened_at__lte=date_range["end"]
        )

    text_fields = [
        "customer_report",
        "diagnosis",
        "service_items__description",
        "service_items__service__name",
        "part_items__description",
        "part_items__part__name",
        "package_items__description",
        "quotes__diagnosis",
        "quotes__rejection_reason",
        "vehicle__brand",
        "vehicle__model",
        "vehicle__version",
        "vehicle__license_plate",
        "customer__name",
    ]
    if allow_internal:
        text_fields.append("internal_notes")

    # Híbrido: com termos de conteúdo, o conjunto é (lexical ∪ semântico); a busca
    # semântica só entra quando há texto real (não em consultas só de status/data).
    # Os IDs semânticos ainda passam pelo filtro de data/status, para não furar o
    # período/estado pedido.
    if concepts:
        lexical_ids = set(
            base.filter(_concepts_q(text_fields, concepts))
            .values_list("id", flat=True)
            .distinct()
        )
        sem_ids = set()
        if semantic_scores:
            sem_ids = set(
                base.filter(id__in=list(semantic_scores)).values_list("id", flat=True)
            )
        ids = lexical_ids | sem_ids
        if not ids:
            return []
        qs = base.filter(id__in=ids)
    else:
        qs = base  # só status/data -- comportamento original
        semantic_scores = {}  # sem termos, similaridade não se aplica

    qs = (
        qs.select_related("customer", "vehicle")
        .prefetch_related(
            "service_items__service", "part_items__part", "package_items", "quotes"
        )
        .order_by("-opened_at", "-id")[:60]
    )

    results = []
    for order in qs:
        sim = semantic_scores.get(order.id)
        reason, snippet = _work_order_reason(
            order, concepts, statuses, date_range, allow_internal, sim
        )
        blob = " ".join(
            filter(
                None,
                [
                    order.customer_report,
                    order.diagnosis,
                    order.internal_notes if allow_internal else "",
                    order.vehicle.brand,
                    order.vehicle.model,
                    order.vehicle.license_plate,
                    order.customer.name,
                    " ".join(i.description for i in order.service_items.all()),
                    " ".join(i.description for i in order.part_items.all()),
                ],
            )
        )
        score = _score(blob, concepts) + (1 if statuses or date_range else 0)
        if sim is not None:
            score += 1 + round(sim)  # dá relevância ao match semântico
        results.append(
            {
                "type": "work_order",
                "id": order.id,
                "title": f"OS #{order.number}",
                "subtitle": _vehicle_label(order.vehicle) + f" · {order.customer.name}",
                "status": _STATUS_LABELS.get(order.status, order.status),
                "date": order.opened_at.isoformat() if order.opened_at else None,
                "snippet": snippet,
                "reason": reason,
                "url": f"/orders/{order.id}",
                "score": score,
            }
        )
    return results


def _work_order_reason(order, concepts, statuses, date_range, allow_internal, sim=None):
    priority = [
        (order.customer_report, "Encontrado no relato do cliente."),
        (order.diagnosis, "Encontrado no diagnóstico técnico."),
        (
            " · ".join(
                i.description or (i.service.name if i.service else "")
                for i in order.service_items.all()
            ),
            "Encontrado nos serviços realizados.",
        ),
        (
            " · ".join(
                i.description or (i.part.name if i.part else "")
                for i in order.part_items.all()
            ),
            "Encontrado nas peças utilizadas.",
        ),
    ]
    if allow_internal:
        priority.append((order.internal_notes, "Encontrado nas observações internas."))

    for text, reason in priority:
        variant = _field_match(text, concepts)
        if variant:
            return reason, _excerpt(text, variant)

    # Casou por veículo/cliente?
    if _field_match(_vehicle_label(order.vehicle), concepts):
        return "Encontrado pelos dados do veículo.", ""
    if _field_match(order.customer.name, concepts):
        return "Encontrado pelo nome do cliente.", ""

    # Sem correspondência literal, mas próximo por significado (busca semântica).
    if sim is not None:
        snippet = _excerpt(order.customer_report or order.diagnosis, "")
        return "Correspondência por semelhança de significado.", snippet

    if statuses:
        return f"Status: {_STATUS_LABELS.get(order.status, order.status)}.", ""
    if date_range:
        return f"Aberta no período solicitado ({date_range['label']}).", ""
    return "Correspondência na ordem de serviço.", ""


def _search_customers(intent, **_):
    concepts = intent["concepts"]
    if not concepts:
        return []
    fields = ["name", "email", "phone", "whatsapp", "notes"]
    qs = Customer.objects.filter(is_active=True).filter(_concepts_q(fields, concepts))[
        :40
    ]

    results = []
    for c in qs:
        reason, snippet = None, ""
        for text, label in [
            (c.name, "Encontrado pelo nome do cliente."),
            (c.notes, "Encontrado nas observações do cliente."),
            (c.email, "Encontrado pelo e-mail."),
        ]:
            variant = _field_match(text, concepts)
            if variant:
                reason, snippet = label, _excerpt(text, variant)
                break
        results.append(
            {
                "type": "customer",
                "id": c.id,
                "title": c.name,
                "subtitle": c.email or c.phone or "",
                "status": None,
                "date": None,
                "snippet": snippet,
                "reason": reason or "Correspondência no cadastro do cliente.",
                "url": f"/customers/{c.id}/360",
                "score": _score(f"{c.name} {c.notes}", concepts),
            }
        )
    return results


def _search_vehicles(intent, **_):
    concepts = intent["concepts"]
    if not concepts:
        return []
    fields = ["license_plate", "brand", "model", "version", "color", "notes"]
    qs = (
        Vehicle.objects.filter(is_active=True)
        .select_related("customer")
        .filter(_concepts_q(fields, concepts))[:40]
    )

    results = []
    for v in qs:
        variant = _field_match(v.notes, concepts)
        if variant:
            reason, snippet = "Encontrado nas observações do veículo.", _excerpt(
                v.notes, variant
            )
        else:
            reason, snippet = "Encontrado pelos dados do veículo.", ""
        results.append(
            {
                "type": "vehicle",
                "id": v.id,
                "title": _vehicle_label(v),
                "subtitle": f"{v.license_plate} · {v.customer.name}",
                "status": None,
                "date": None,
                "snippet": snippet,
                "reason": reason,
                "url": "/vehicles",
                "score": _score(
                    f"{_vehicle_label(v)} {v.license_plate} {v.notes}", concepts
                ),
            }
        )
    return results


def _search_leads(intent, **_):
    concepts = intent["concepts"]
    date_range = intent["date_range"]
    if not concepts and not date_range:
        return []
    qs = SiteLead.objects.all()
    if date_range:
        qs = qs.filter(
            created_at__date__gte=date_range["start"],
            created_at__date__lte=date_range["end"],
        )
    if concepts:
        fields = ["name", "message", "vehicle_plate", "vehicle_brand", "vehicle_model"]
        qs = qs.filter(_concepts_q(fields, concepts))
    qs = qs.order_by("-created_at")[:40]

    results = []
    for lead in qs:
        variant = _field_match(lead.message, concepts)
        snippet = _excerpt(lead.message, variant) if variant else ""
        results.append(
            {
                "type": "lead",
                "id": lead.id,
                "title": f"Pedido do site — {lead.name}",
                "subtitle": " ".join(
                    filter(
                        None,
                        [lead.vehicle_brand, lead.vehicle_model, lead.vehicle_plate],
                    )
                ),
                "status": lead.get_status_display(),
                "date": lead.created_at.date().isoformat() if lead.created_at else None,
                "snippet": snippet,
                "reason": "Encontrado no pedido vindo do site.",
                "url": f"/leads/{lead.id}",
                "score": _score(f"{lead.name} {lead.message}", concepts)
                + (1 if date_range else 0),
            }
        )
    return results


def _search_financial(intent, **_):
    concepts = intent["concepts"]
    date_range = intent["date_range"]
    qs = Payment.objects.select_related("order", "order__customer")
    if date_range:
        qs = qs.filter(paid_at__gte=date_range["start"], paid_at__lte=date_range["end"])
    if concepts:
        qs = qs.filter(_concepts_q(["note", "order__customer__name"], concepts))
    qs = qs.order_by("-paid_at")[:30]

    results = []
    for p in qs:
        results.append(
            {
                "type": "financial",
                "id": p.id,
                "title": f"Pagamento · OS #{p.order.number}",
                "subtitle": f"{p.order.customer.name} · {p.get_method_display()}",
                "status": None,
                "date": p.paid_at.isoformat() if p.paid_at else None,
                "snippet": (
                    _excerpt(p.note, _field_match(p.note, concepts) or "")
                    if concepts
                    else ""
                ),
                "reason": "Encontrado nos pagamentos da OS.",
                "url": f"/orders/{p.order_id}",
                "score": 1,
            }
        )
    return results


_SEARCHERS = {
    "work_order": _search_work_orders,
    "customer": _search_customers,
    "vehicle": _search_vehicles,
    "lead": _search_leads,
    "financial": _search_financial,
}

_GROUP_LABELS = {
    "work_order": "Ordens de Serviço",
    "customer": "Clientes",
    "vehicle": "Veículos",
    "lead": "Pedidos do site",
    "financial": "Financeiro",
}


def _vehicle_label(vehicle):
    return (
        " ".join(p for p in [vehicle.brand, vehicle.model] if p)
        or vehicle.license_plate
    )


def _resolve_entities(intent, *, user, settings_obj):
    """Decide quais entidades buscar, respeitando permissões e configuração.

    A busca é GLOBAL: sempre inclui OS, clientes, veículos e pedidos do site.
    Uma palavra genérica como "carro" ou "cliente" não deve restringir o escopo
    (ex.: "carro em revisão" precisa achar a OS pelo relato/diagnóstico/serviço).
    Entidades detectadas só ADICIONAM (o caso do financeiro, que fica fora do
    padrão por privacidade e só entra quando a pergunta é claramente financeira).
    """
    detected = intent.get("entities") or []
    candidates = list(DEFAULT_ENTITIES)
    for entity in detected:
        if entity in _SEARCHERS and entity not in candidates:
            candidates.append(entity)

    resolved = []
    for entity in candidates:
        if not _can(user, ENTITY_PERMISSION[entity]):
            continue
        if entity == "financial" and not settings_obj.include_financial:
            continue
        resolved.append(entity)
    return resolved


def _applied_filters(intent, entities):
    # Não exibimos "Tipo" como filtro: a busca é sempre global entre entidades,
    # então mostrar um tipo seria enganoso (os resultados já vêm agrupados).
    filters = []
    if intent.get("date_range"):
        filters.append({"label": "Período", "value": intent["date_range"]["label"]})
    if intent.get("statuses"):
        labels = [_STATUS_LABELS.get(s, s) for s in intent["statuses"]]
        filters.append({"label": "Status", "value": ", ".join(labels)})
    concept_labels = [c["label"] for c in intent.get("concepts", [])]
    if concept_labels:
        filters.append({"label": "Texto", "value": " · ".join(concept_labels)})
    return filters


def run_search(query, *, user, settings_obj, limit=None):
    """Ponto de entrada: interpreta, executa com segurança e devolve o payload."""
    started = time.monotonic()
    limit = limit or settings_obj.result_limit

    base = interpret(query, today=timezone.localdate(), limit=limit)
    intent, used_ai = enhance_intent(query, base, settings_obj)

    entities = _resolve_entities(intent, user=user, settings_obj=settings_obj)

    # Busca semântica só faz sentido com texto real e sobre as OS (onde há relato/
    # diagnóstico). Devolve {} quando desligada/indisponível (fallback lexical).
    semantic_scores = {}
    if "work_order" in entities and intent["concepts"]:
        semantic_scores = semantic_work_order_scores(query, settings_obj)
    used_semantic = bool(semantic_scores)

    results = []
    for entity in entities:
        if entity == "work_order":
            results.extend(
                _search_work_orders(
                    intent,
                    user=user,
                    settings_obj=settings_obj,
                    semantic_scores=semantic_scores,
                )
            )
        else:
            results.extend(
                _SEARCHERS[entity](intent, user=user, settings_obj=settings_obj)
            )

    results.sort(key=lambda r: (r["score"], r["date"] or ""), reverse=True)
    total = len(results)
    results = results[:limit]

    groups = []
    for entity in ("work_order", "vehicle", "customer", "lead", "financial"):
        items = [r for r in results if r["type"] == entity]
        if items:
            groups.append(
                {"type": entity, "label": _GROUP_LABELS[entity], "results": items}
            )

    payload = {
        "query": query,
        "interpreted": {
            "entities": intent.get("entities") or entities,
            "period": (
                intent["date_range"]["label"] if intent.get("date_range") else None
            ),
            "statuses": [_STATUS_LABELS.get(s, s) for s in intent.get("statuses", [])],
            "terms": [c["label"] for c in intent.get("concepts", [])],
        },
        "applied_filters": _applied_filters(intent, entities),
        "results": results,
        "groups": groups,
        "total": total,
        "truncated": total > len(results),
        "used_ai": used_ai,
        "used_semantic": used_semantic,
    }

    duration_ms = int((time.monotonic() - started) * 1000)
    _record(query, intent, payload, user, settings_obj, used_ai, duration_ms)
    return payload


def _record(query, intent, payload, user, settings_obj, used_ai, duration_ms):
    if settings_obj.log_queries:
        SearchLog.objects.create(
            user=user if getattr(user, "pk", None) else None,
            query=query[:500],
            interpreted={
                "entities": intent.get("entities"),
                "statuses": intent.get("statuses"),
                "period": (
                    intent["date_range"]["label"] if intent.get("date_range") else None
                ),
                "terms": [c["label"] for c in intent.get("concepts", [])],
            },
            applied_filters=payload["applied_filters"],
            result_count=payload["total"],
            used_ai=used_ai,
            duration_ms=duration_ms,
        )
    if settings_obj.store_history and getattr(user, "pk", None):
        normalized = deaccent(query.strip())[:500]
        if normalized:
            RecentSearch.objects.update_or_create(
                user=user,
                normalized=normalized,
                defaults={"query": query.strip()[:500]},
            )
