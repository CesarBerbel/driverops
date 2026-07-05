from django.db.models import Max

from apps.orders.status_groups import OPEN_STATUSES
from apps.services.models import ServicePart

from .models import Quote, QuoteItem


def _line_description(item, linked):
    """Nome congelado da linha: descrição livre (avulso) ou nome do cadastrado."""
    if item.description:
        return item.description
    return linked.name if linked is not None else ""


def _part_to_service_map(order):
    """Mapa {id da peça de catálogo -> id do serviço de catálogo} das peças padrão
    dos serviços presentes na OS. Usado para vincular a peça ao serviço no snapshot.
    """
    service_ids = [si.service_id for si in order.service_items.all() if si.service_id]
    mapping = {}
    if service_ids:
        for sp in ServicePart.objects.filter(service_id__in=service_ids):
            # Primeira ocorrência vence (ordem determinística por serviço/linha).
            mapping.setdefault(sp.part_id, sp.service_id)
    return mapping


def create_quote_from_order(order, user=None, valid_until=None):
    """Cria um novo orçamento (nova versão) a partir da OS, com snapshot dos itens.

    Peças que são **peça padrão** de um serviço presente na OS são vinculadas a
    esse serviço (``linked_service``) para que sejam aprovadas/recusadas juntas.
    """
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

    # Serviços primeiro (para obter os ids e vincular as peças depois).
    service_items = []  # (QuoteItem, catalog_service_id)
    for si in order.service_items.all():
        service_items.append(
            (
                QuoteItem(
                    quote=quote,
                    kind=QuoteItem.Kind.SERVICE,
                    description=_line_description(si, si.service),
                    quantity=si.quantity,
                    unit_price=si.unit_price,
                    is_custom=si.service_id is None,
                ),
                si.service_id,
            )
        )
    QuoteItem.objects.bulk_create([row[0] for row in service_items])
    service_item_by_catalog = {
        catalog_id: item for item, catalog_id in service_items if catalog_id
    }

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
        linked = None
        if pi.part_id and pi.part_id in part_to_service:
            linked = service_item_by_catalog.get(part_to_service[pi.part_id])
        part_items.append(
            QuoteItem(
                quote=quote,
                kind=QuoteItem.Kind.PART,
                description=_line_description(pi, pi.part),
                quantity=pi.quantity,
                unit_price=pi.unit_price,
                is_custom=pi.part_id is None,
                linked_service=linked,
            )
        )
    QuoteItem.objects.bulk_create(part_items)
    return quote


def apply_item_decisions(quote, approved_ids):
    """Aplica a decisão do cliente item a item e devolve o status geral resultante.

    ``approved_ids`` = ids dos itens aprovados; os demais são recusados. Se for
    ``None``, aprova todos (aprovação integral -- mantém o comportamento anterior).
    Regra do status geral:
    - todos aprovados  -> "approved" (aprovado integralmente)
    - todos recusados  -> "rejected"
    - misto            -> "partially_approved"
    Um orçamento sem itens é tratado como recusado (nada a executar).

    Peças vinculadas a um serviço (``linked_service``) **seguem a decisão do
    serviço** -- não se pode recusar a peça sem recusar o serviço nem vice-versa.
    """
    items = list(quote.items.all())
    approve_all = approved_ids is None
    approved_set = set(approved_ids or [])

    # Decisão dos serviços primeiro (mestres do grupo).
    service_decision = {
        item.id: (approve_all or item.id in approved_set)
        for item in items
        if item.kind == QuoteItem.Kind.SERVICE
    }

    n_approved = 0
    for item in items:
        if item.linked_service_id in service_decision:
            # Peça vinculada: segue o serviço.
            approved = service_decision[item.linked_service_id]
        else:
            approved = approve_all or item.id in approved_set
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


def advance_order_after_approval(order):
    """Avança a OS para 'Aprovada' quando o orçamento é aprovado.

    Só avança a partir de estágios iniciais (aberta/diagnóstico/aguardando
    aprovação) -- nunca regride uma OS que já esteja além disso.
    """
    if order.status in OPEN_STATUSES:
        order.status = "approved"
        order.save(update_fields=["status", "updated_at"])
