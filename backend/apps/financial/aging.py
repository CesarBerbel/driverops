"""Aging (envelhecimento) de contas a receber -- funções puras.

Sem imports de models para poder ser usado tanto no serializer da OS quanto no
endpoint de recebíveis, sem risco de import circular. Um recebível é o saldo
devedor de uma OS; o aging é calculado a partir do vencimento (``payment_due_date``)
em relação a "hoje".
"""

# Ordem importa (do mais novo ao mais vencido) para relatórios de aging.
BUCKETS = [
    ("no_due_date", "Sem vencimento"),
    ("not_due", "A vencer"),
    ("overdue_1_30", "Vencido (1–30 dias)"),
    ("overdue_31_60", "Vencido (31–60 dias)"),
    ("overdue_61_90", "Vencido (61–90 dias)"),
    ("overdue_90_plus", "Vencido (+90 dias)"),
]
BUCKET_LABELS = dict(BUCKETS)
OVERDUE_BUCKETS = (
    "overdue_1_30",
    "overdue_31_60",
    "overdue_61_90",
    "overdue_90_plus",
)


def days_overdue(due_date, today):
    """Dias de atraso (0 se em dia ou sem vencimento)."""
    if not due_date:
        return 0
    delta = (today - due_date).days
    return delta if delta > 0 else 0


def bucket_for(due_date, today):
    """Faixa de aging a partir do vencimento."""
    if not due_date:
        return "no_due_date"
    delta = (today - due_date).days
    if delta <= 0:
        return "not_due"
    if delta <= 30:
        return "overdue_1_30"
    if delta <= 60:
        return "overdue_31_60"
    if delta <= 90:
        return "overdue_61_90"
    return "overdue_90_plus"


def is_overdue(bucket):
    return bucket in OVERDUE_BUCKETS
