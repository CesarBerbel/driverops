from decimal import Decimal

CENTS = Decimal("0.01")


def money(value):
    return Decimal(value).quantize(CENTS)


def item_subtotal(item):
    quantity = item.quantity or Decimal("0")
    unit_price = item.unit_price or Decimal("0")
    total = quantity * unit_price
    return money(total if total > 0 else Decimal("0"))


def compute_totals(quote):
    """Totais do orçamento (Decimals) calculados a partir das linhas -- backend
    é a fonte da verdade. Nunca persistidos."""
    items = list(quote.items.all())

    def kind_total(kind):
        return money(
            sum((item_subtotal(i) for i in items if i.kind == kind), Decimal("0"))
        )

    gross = money(sum((item_subtotal(i) for i in items), Decimal("0")))
    discount = Decimal("0")
    if quote.discount_type == "percent":
        discount = gross * (quote.discount_value or Decimal("0")) / Decimal("100")
    elif quote.discount_type == "fixed":
        discount = quote.discount_value or Decimal("0")
    discount = money(discount)
    final = gross - discount
    final = money(final if final > 0 else Decimal("0"))
    return {
        "services_total": kind_total("service"),
        "packages_total": kind_total("package"),
        "parts_total": kind_total("part"),
        "gross_total": gross,
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
