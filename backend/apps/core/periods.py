from datetime import timedelta

from django.utils import timezone


def period_start_date(period):
    """Data inicial (inclusiva) para um período nomeado do Dashboard.

    Retorna ``None`` para "all"/desconhecido (sem recorte). Usada tanto para
    campos ``DateField`` (opened_at) quanto ``DateTimeField`` (via ``__date__gte``).
    """
    today = timezone.localdate()
    if period == "today":
        return today
    if period == "week":
        return today - timedelta(days=today.weekday())
    if period == "month":
        return today.replace(day=1)
    if period == "last30":
        return today - timedelta(days=30)
    return None
