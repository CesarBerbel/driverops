"""Registro da linha do tempo de status da OS.

Chamado pelo `WorkOrderViewSet` sempre que o status muda (criação, arrastar no
Kanban ou editar). Mantém o histórico desacoplado das views de mutação.
"""

from .models import OrderStatusHistory


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
        changed_by=user if (user and user.is_authenticated) else None,
        note=note,
    )
