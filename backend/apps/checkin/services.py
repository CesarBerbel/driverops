from django.db.models import Max
from django.utils import timezone

from apps.accounts.audit import record_audit

from .models import (
    DEFAULT_CHECKLIST_ITEMS,
    CheckInStatus,
    VehicleCheckIn,
    VehicleCheckInItem,
)


def get_or_create_check_in(order, user):
    """Devolve o check-in da OS, criando (com checklist padrão) na primeira vez."""
    check_in = getattr(order, "check_in", None)
    if check_in is not None:
        return check_in, False
    actor = user if getattr(user, "is_authenticated", False) else None
    check_in = VehicleCheckIn.objects.create(
        order=order, created_by=actor, updated_by=actor
    )
    VehicleCheckInItem.objects.bulk_create(
        [
            VehicleCheckInItem(check_in=check_in, name=name, position=i)
            for i, name in enumerate(DEFAULT_CHECKLIST_ITEMS)
        ]
    )
    return check_in, True


def next_damage_sequence(check_in):
    current = check_in.damages.aggregate(m=Max("sequence"))["m"] or 0
    return current + 1


def touch(check_in, user):
    check_in.updated_by = user if getattr(user, "is_authenticated", False) else None
    check_in.save(update_fields=["updated_by", "updated_at"])


def complete(check_in, user):
    check_in.status = CheckInStatus.COMPLETED
    check_in.completed_by = user if getattr(user, "is_authenticated", False) else None
    check_in.completed_at = timezone.now()
    check_in.save(
        update_fields=["status", "completed_by", "completed_at", "updated_at"]
    )


def reopen(check_in, user):
    check_in.status = CheckInStatus.IN_PROGRESS
    check_in.updated_by = user if getattr(user, "is_authenticated", False) else None
    # Precisa incluir "status" no update_fields -- touch() salva só updated_by,
    # o que deixaria o banco travado (completed) apesar da resposta reaberta.
    check_in.save(update_fields=["status", "updated_by", "updated_at"])


def audit(request, action, check_in, **extra):
    value = {"check_in": check_in.id, "order": check_in.order_id}
    value.update(extra)
    record_audit(request, action, new_value=value)
