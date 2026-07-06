"""Registro da linha do tempo de status da OS.

Chamado pelo `WorkOrderViewSet` sempre que o status muda (criação, arrastar no
Kanban ou editar). Mantém o histórico desacoplado das views de mutação.
"""

from .models import OrderEvent, OrderStatusHistory


def _real_user(user):
    return user if (user and getattr(user, "is_authenticated", False)) else None


def record_status_change(order, from_status, to_status, user=None, note=""):
    """Cria uma entrada de histórico. No-op se o status não mudou de fato.

    `from_status` vazio ("") marca a criação da OS.
    """
    if from_status == to_status:
        return None
    return OrderStatusHistory.objects.create(
        order=order,
        from_status=from_status or "",
        to_status=to_status,
        changed_by=_real_user(user),
        note=note,
    )


def record_event(order, event_type, description="", actor=None, channel=""):
    """Registra um evento na linha do tempo unificada da OS (append-only)."""
    return OrderEvent.objects.create(
        order=order,
        event_type=event_type,
        description=description,
        actor=_real_user(actor),
        channel=channel,
    )
