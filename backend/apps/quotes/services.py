from django.db.models import Max

from apps.orders.status_groups import OPEN_STATUSES

from .models import Quote, QuoteItem


def _line_description(item, linked):
    """Nome congelado da linha: descrição livre (avulso) ou nome do cadastrado."""
    if item.description:
        return item.description
    return linked.name if linked is not None else ""


def _snapshot_items(order):
    """Monta as linhas do orçamento (não salvas) a partir dos itens da OS."""
    items = []
    for si in order.service_items.all():
        items.append(
            QuoteItem(
                kind=QuoteItem.Kind.SERVICE,
                description=_line_description(si, si.service),
                quantity=si.quantity,
                unit_price=si.unit_price,
                is_custom=si.service_id is None,
            )
        )
    for pi in order.package_items.all():
        items.append(
            QuoteItem(
                kind=QuoteItem.Kind.PACKAGE,
                description=_line_description(pi, pi.package),
                quantity=pi.quantity,
                unit_price=pi.unit_price,
                is_custom=pi.package_id is None,
            )
        )
    for pi in order.part_items.all():
        items.append(
            QuoteItem(
                kind=QuoteItem.Kind.PART,
                description=_line_description(pi, pi.part),
                quantity=pi.quantity,
                unit_price=pi.unit_price,
                is_custom=pi.part_id is None,
            )
        )
    return items


def create_quote_from_order(order, user=None, valid_until=None):
    """Cria um novo orçamento (nova versão) a partir da OS, com snapshot dos itens."""
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
    items = _snapshot_items(order)
    for item in items:
        item.quote = quote
    QuoteItem.objects.bulk_create(items)
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
    """
    items = list(quote.items.all())
    approve_all = approved_ids is None
    approved_set = set(approved_ids or [])

    n_approved = 0
    for item in items:
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
