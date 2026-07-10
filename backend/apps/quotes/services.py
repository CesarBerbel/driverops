from django.db import transaction
from django.db.models import Max

from apps.services.models import ServicePart

from .models import Quote, QuoteItem


def _line_description(item, linked):
    """Nome congelado da linha: descrição livre (avulso) ou nome do cadastrado."""
    if item.description:
        return item.description
    return linked.name if linked is not None else ""


def _part_to_service_map(order):
    """Mapa {id da peça de catálogo -> (id do serviço, is_required)} das peças
    padrão dos serviços presentes na OS. Usado para vincular a peça ao serviço no
    snapshot e carregar a obrigatoriedade configurada no cadastro do serviço.
    """
    service_ids = [si.service_id for si in order.service_items.all() if si.service_id]
    mapping = {}
    if service_ids:
        for sp in ServicePart.objects.filter(service_id__in=service_ids):
            # Primeira ocorrência vence (ordem determinística por serviço/linha).
            mapping.setdefault(sp.part_id, (sp.service_id, sp.is_required))
    return mapping


def create_quote_from_order(order, user=None, valid_until=None):
    """Cria um novo orçamento (nova versão) a partir da OS, com snapshot dos itens.

    Peças que são **peça padrão** de um serviço presente na OS são vinculadas a
    esse serviço (``linked_service``) para que sejam aprovadas/recusadas juntas.
    A OS é travada durante a criação para serializar versões concorrentes da
    mesma ordem.
    """
    with transaction.atomic():
        order = type(order).objects.select_for_update().get(pk=order.pk)
        last_version = (
            Quote.objects.filter(work_order=order).aggregate(m=Max("version"))["m"] or 0
        )
        quote = Quote.objects.create(
            work_order=order,
            version=last_version + 1,
            customer_report=order.customer_report,
            diagnosis=order.diagnosis,
            discount_type=order.discount_type,
            discount_value=order.discount_value,
            valid_until=valid_until,
            created_by=user,
        )

        return _create_quote_items_from_order(quote, order)


def _create_quote_items_from_order(quote, order):
    # Serviços primeiro (para obter os ids e vincular as peças depois). A ordem é
    # preservada, então o i-ésimo serviço da OS vira o i-ésimo item de serviço.
    order_services = list(order.service_items.all())
    quote_services = [
        QuoteItem(
            quote=quote,
            kind=QuoteItem.Kind.SERVICE,
            description=_line_description(si, si.service),
            quantity=si.quantity,
            unit_price=si.unit_price,
            is_custom=si.service_id is None,
        )
        for si in order_services
    ]
    QuoteItem.objects.bulk_create(quote_services)
    # Mapas para vincular as peças: por serviço da OS (associação manual, inclui
    # avulsos) e por serviço de catálogo (associação automática por peça padrão).
    service_item_by_wo = {}
    service_item_by_catalog = {}
    for si, qsi in zip(order_services, quote_services):
        service_item_by_wo[si.id] = qsi
        if si.service_id:
            service_item_by_catalog.setdefault(si.service_id, qsi)

    QuoteItem.objects.bulk_create(
        [
            QuoteItem(
                quote=quote,
                kind=QuoteItem.Kind.PACKAGE,
                description=_line_description(pi, pi.package),
                quantity=pi.quantity,
                unit_price=pi.unit_price,
                is_custom=pi.package_id is None,
            )
            for pi in order.package_items.all()
        ]
    )

    part_to_service = _part_to_service_map(order)
    part_items = []
    for pi in order.part_items.all():
        # Associação manual na OS tem precedência (funciona também para avulsas);
        # senão, cai na associação automática por peça padrão do catálogo. A
        # obrigatoriedade e a origem (avulsa associada x padrão) acompanham.
        linked = None
        is_required = True
        source = QuoteItem.PartSource.INDEPENDENT
        if pi.linked_service_id and pi.linked_service_id in service_item_by_wo:
            linked = service_item_by_wo[pi.linked_service_id]
            is_required = pi.is_required
            source = QuoteItem.PartSource.MANUAL
        elif pi.part_id and pi.part_id in part_to_service:
            service_id, catalog_required = part_to_service[pi.part_id]
            linked = service_item_by_catalog.get(service_id)
            if linked is not None:
                is_required = catalog_required
                source = QuoteItem.PartSource.STANDARD
        part_items.append(
            QuoteItem(
                quote=quote,
                kind=QuoteItem.Kind.PART,
                description=_line_description(pi, pi.part),
                quantity=pi.quantity,
                unit_price=pi.unit_price,
                is_custom=pi.part_id is None,
                linked_service=linked,
                is_required=is_required if linked is not None else True,
                part_source=source,
            )
        )
    QuoteItem.objects.bulk_create(part_items)
    return quote


def _decision_violation(detail, code, offending, service_by_id):
    """Monta o corpo de erro estruturado de uma decisão inconsistente."""
    return {
        "detail": detail,
        "code": code,
        "items": [
            {
                "service_item_id": item.linked_service_id,
                "service_name": (
                    service_by_id[item.linked_service_id].description
                    if item.linked_service_id in service_by_id
                    else ""
                ),
                "part_item_id": item.id,
                "part_name": item.description,
                "association_type": item.part_source or "",
                "requirement": "required" if item.is_required else "optional",
            }
            for item in offending
        ],
    }


def apply_item_decisions(quote, approved_ids, *, request=None):
    """Aplica a decisão do cliente item a item e devolve o status geral resultante.

    ``approved_ids`` = ids dos itens aprovados; os demais são recusados. Se for
    ``None``, aprova todos (aprovação integral -- mantém o comportamento anterior).
    Status geral: todos aprovados -> "approved"; todos recusados -> "rejected";
    misto -> "partially_approved". Sem itens => recusado.

    Regras de peças vinculadas a um serviço (``linked_service``):
    - Serviço recusado -> a peça acompanha a recusa (obrigatória ou opcional).
    - Serviço aprovado + peça **obrigatória** -> a peça deve ser aprovada; recusá-la
      separadamente é bloqueado (400 estruturado).
    - Serviço aprovado + peça **opcional** -> pode ser aprovada ou recusada.
    - Peça sem vínculo (avulsa independente) -> decidida por conta própria.
    O backend é a fonte da verdade: payloads manipulados são rejeitados. Quando
    ``request`` é informado, eventos críticos são auditados (tentativa bloqueada e
    recusa de peça opcional na aprovação parcial).
    """
    from rest_framework.exceptions import ValidationError

    from apps.accounts.audit import record_audit

    items = list(quote.items.all())
    approve_all = approved_ids is None
    approved_set = set(approved_ids or [])

    service_by_id = {
        item.id: item for item in items if item.kind == QuoteItem.Kind.SERVICE
    }
    service_decision = {
        sid: (approve_all or sid in approved_set) for sid in service_by_id
    }

    final = {}
    rejected_required = []  # obrigatória de serviço aprovado marcada p/ recusa
    rejected_optional = []  # opcional de serviço aprovado recusada (auditável)
    for item in items:
        if item.linked_service_id in service_decision:
            svc_approved = service_decision[item.linked_service_id]
            wants_approve = approve_all or item.id in approved_set
            if not svc_approved:
                # Serviço recusado -> a peça acompanha a recusa (cascata),
                # ainda que o payload a tenha marcado (nunca fica aprovada).
                final[item.id] = False
            elif item.is_required:
                # Serviço aprovado + obrigatória -> não pode ser recusada.
                final[item.id] = True
                if not wants_approve:
                    rejected_required.append(item)
            else:
                # Serviço aprovado + opcional -> respeita a decisão.
                final[item.id] = wants_approve
                if not wants_approve:
                    rejected_optional.append(item)
        else:
            final[item.id] = approve_all or item.id in approved_set

    if rejected_required:
        if request is not None:
            record_audit(
                request,
                "quotes.required_part_rejection_blocked",
                new_value={
                    "quote": quote.id,
                    "parts": [p.id for p in rejected_required],
                },
            )
        raise ValidationError(
            _decision_violation(
                "Peças obrigatórias vinculadas a serviços aprovados não podem ser "
                "recusadas separadamente. Para não aprovar a peça, recuse também o "
                "serviço relacionado.",
                "required_service_part_cannot_be_rejected",
                rejected_required,
                service_by_id,
            )
        )

    if request is not None and rejected_optional:
        record_audit(
            request,
            "quotes.optional_parts_rejected",
            new_value={
                "quote": quote.id,
                "parts": [p.id for p in rejected_optional],
            },
        )

    n_approved = 0
    for item in items:
        approved = final[item.id]
        item.status = item.ItemStatus.APPROVED if approved else item.ItemStatus.REJECTED
        if approved:
            n_approved += 1
    if items:
        QuoteItem.objects.bulk_update(items, ["status"])

    if not items or n_approved == 0:
        return Quote.Status.REJECTED
    if n_approved == len(items):
        return Quote.Status.APPROVED
    return Quote.Status.PARTIALLY_APPROVED


def advance_order_after_approval(order, actor=None):
    """Avança a OS para 'Aprovada' quando o orçamento é aprovado.

    Delega à máquina de estados da OS (origem = aprovação), que valida, registra
    histórico/timeline e dispara efeitos colaterais. Só avança a partir dos
    estágios iniciais -- nunca regride uma OS que já esteja além disso.
    """
    from apps.orders.state_machine import system_advance_to_approved

    system_advance_to_approved(order, actor=actor)
