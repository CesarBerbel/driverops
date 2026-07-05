from .models import AuditLog


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_audit(request, action, target_user=None, old_value=None, new_value=None):
    """Registra uma ação sensível na trilha de auditoria.

    ``action`` é um código curto (ex.: "user.create", "permission.grant"). Guarda
    o responsável (usuário logado), o usuário afetado, valores anterior/novo e o
    IP/user agent quando disponíveis.
    """
    actor = (
        request.user
        if getattr(request, "user", None) and request.user.is_authenticated
        else None
    )
    AuditLog.objects.create(
        actor=actor,
        target_user=target_user,
        action=action,
        old_value=old_value,
        new_value=new_value,
        ip=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
    )
