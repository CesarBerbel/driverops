from decimal import Decimal

# Fonte única do cálculo de dinheiro/desconto (compartilhada com a OS).
from apps.core.money import apply_discount as _apply_discount
from apps.core.money import money

CENTS = Decimal("0.01")


def item_subtotal(item):
    quantity = item.quantity or Decimal("0")
    unit_price = item.unit_price or Decimal("0")
    total = quantity * unit_price
    return money(total if total > 0 else Decimal("0"))


def compute_totals(quote):
    """Totais do orçamento (Decimals) calculados a partir das linhas -- backend
    é a fonte da verdade. Nunca persistidos.

    Suporta aprovação parcial: separa orçado/aprovado/recusado/pendente. Antes de
    qualquer decisão (rascunho/enviado/visualizado), a base do valor final é a
    proposta inteira; após a decisão, apenas os itens aprovados compõem o valor
    final aprovado. Itens recusados/pendentes nunca entram no valor final.
    """
    items = list(quote.items.all())

    def kind_total(kind):
        return money(
            sum((item_subtotal(i) for i in items if i.kind == kind), Decimal("0"))
        )

    def status_total(status):
        return money(
            sum((item_subtotal(i) for i in items if i.status == status), Decimal("0"))
        )

    total_quoted = money(sum((item_subtotal(i) for i in items), Decimal("0")))
    total_approved = status_total("approved")
    total_rejected = status_total("rejected")
    total_pending = status_total("pending")

    decided = quote.status in ("partially_approved", "approved", "rejected")
    base = total_approved if decided else total_quoted
    discount = _apply_discount(base, quote.discount_type, quote.discount_value)
    final = money(max(base - discount, Decimal("0")))

    return {
        "services_total": kind_total("service"),
        "packages_total": kind_total("package"),
        "parts_total": kind_total("part"),
        "gross_total": total_quoted,
        "total_quoted": total_quoted,
        "total_approved": total_approved,
        "total_rejected": total_rejected,
        "total_pending": total_pending,
        "discount_value": discount,
        "final_value": final,
    }


def format_brl(value):
    """Decimal/valor -> 'R$ 1.234,56' (padrão brasileiro)."""
    quantized = money(value)
    integer, _, decimals = f"{quantized:.2f}".partition(".")
    negative = integer.startswith("-")
    integer = integer.lstrip("-")
    with_thousands = ""
    while len(integer) > 3:
        with_thousands = "." + integer[-3:] + with_thousands
        integer = integer[:-3]
    with_thousands = integer + with_thousands
    sign = "-" if negative else ""
    return f"{sign}R$ {with_thousands},{decimals}"
