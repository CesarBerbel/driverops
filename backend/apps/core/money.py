"""Helpers monetários compartilhados (fonte única de cálculo de desconto).

Antes, OS (``orders/serializers.py``) e orçamento (``quotes/calc.py``)
reimplementavam o desconto de forma independente -- inclusive divergindo no
desconto fixo. Agora ambos usam ``apply_discount`` daqui.
"""

from decimal import Decimal

CENTS = Decimal("0.01")


def money(value):
    """Quantiza para 2 casas (centavos)."""
    return Decimal(value).quantize(CENTS)


def apply_discount(base, discount_type, discount_value):
    """Desconto sobre uma base. Percentual preserva a proporção; fixo é limitado
    à base. Nunca negativo. ``discount_type`` é ``"percent"``/``"fixed"`` (qualquer
    outro valor = sem desconto)."""
    base = base or Decimal("0")
    if discount_type == "percent":
        discount = base * (discount_value or Decimal("0")) / Decimal("100")
    elif discount_type == "fixed":
        discount = min(discount_value or Decimal("0"), base)
    else:
        discount = Decimal("0")
    return money(discount if discount > 0 else Decimal("0"))
