"""Serviços da central: criação com deduplicação, fan-out por permissão e leitura.

Ninguém cria ``Notification`` direto: tudo passa por ``emit`` (avisos
automáticos) ou ``create_manual`` (avisos manuais), que resolvem os
destinatários respeitando permissões de módulo e preferências do usuário.
"""

from datetime import timedelta

from django.conf import settings as dj_settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone

from .models import (
    DEFAULT_PRIORITY,
    HIGH_PRIORITY,
    MODULE_PERMISSION,
    TYPE_MODULE,
    Notification,
    NotificationPreference,
    NotificationRule,
    NotifOrigin,
    NotifPriority,
    NotifStatus,
)


class _DefaultPref:
    muted_modules = ()
    only_assigned = False
    only_high_priority = False
    mute_informational = False


_DEFAULT_PREF = _DefaultPref()


def _pref_map():
    return {p.user_id: p for p in NotificationPreference.objects.all()}


def users_with_permission(code):
    """Usuários ativos que possuem ``code`` (superuser sempre incluído)."""
    User = get_user_model()
    return [
        u
        for u in User.objects.filter(is_active=True)
        if u.is_superuser or u.has_perm_code(code)
    ]


def resolve_recipients(module, priority, *, assignee_id=None, rule=None):
    """Quem deve receber um aviso deste módulo/prioridade.

    Exige ``alerts.view`` (gate da central) + a permissão do módulo, restringe
    aos papéis da regra (quando definidos) e aplica preferências individuais.
    """
    User = get_user_model()
    module_perm = MODULE_PERMISSION.get(module)
    role_keys = set(rule.recipient_roles) if rule and rule.recipient_roles else None
    prefs = _pref_map()
    recipients = []
    for u in User.objects.filter(is_active=True).select_related("role"):
        allowed = u.is_superuser or u.has_perm_code("alerts.view")
        if not allowed:
            continue
        if module_perm and not (u.is_superuser or u.has_perm_code(module_perm)):
            continue
        if role_keys is not None and not u.is_superuser:
            if not (u.role and u.role.key in role_keys):
                continue
        pref = prefs.get(u.id, _DEFAULT_PREF)
        if module in (pref.muted_modules or ()):
            continue
        if pref.mute_informational and priority == NotifPriority.INFO:
            continue
        if pref.only_high_priority and priority not in HIGH_PRIORITY:
            continue
        if pref.only_assigned and assignee_id and assignee_id != u.id:
            continue
        recipients.append(u)
    return recipients


def _send_internal_email(user, title, message):
    email = getattr(user, "email", "")
    if not email:
        return
    send_mail(
        subject=title,
        message=message,
        from_email=dj_settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )


def _upsert(
    user,
    *,
    notif_type,
    module,
    priority,
    fields,
    dedup_key,
    expires_at,
    origin,
    created_by,
):
    """Cria a notificação ou, se já existe (dedup) e ainda não lida, atualiza."""
    if dedup_key:
        existing = Notification.objects.filter(
            recipient=user, dedup_key=dedup_key
        ).first()
        if existing:
            if existing.status == NotifStatus.UNREAD:
                for key, value in fields.items():
                    setattr(existing, key, value)
                existing.priority = priority
                existing.expires_at = expires_at
                existing.save()
            return existing, False
    notif = Notification.objects.create(
        recipient=user,
        audience_role=getattr(user, "role", None),
        notif_type=notif_type,
        module=module,
        priority=priority,
        dedup_key=dedup_key,
        expires_at=expires_at,
        origin=origin,
        created_by=created_by,
        **fields,
    )
    return notif, True


def emit(
    notif_type,
    *,
    title,
    message,
    detail="",
    related_type="",
    related_id=None,
    url="",
    action_label="",
    data=None,
    dedup_key="",
    assignee_id=None,
    priority=None,
    expires_at=None,
):
    """Emite um aviso automático para todos os destinatários elegíveis.

    Retorna a lista de notificações efetivamente criadas (deduplicadas não
    contam). Respeita a regra do tipo (ativa/prioridade/expiração/e-mail).
    """
    rule = NotificationRule.get_for(notif_type)
    if not (rule.is_enabled and rule.show_in_bell):
        return []
    module = TYPE_MODULE[notif_type]
    prio = (
        priority
        or rule.priority
        or DEFAULT_PRIORITY.get(notif_type, NotifPriority.IMPORTANT)
    )
    if expires_at is None and rule.auto_expire_days:
        expires_at = timezone.now() + timedelta(days=rule.auto_expire_days)

    fields = {
        "title": title,
        "message": message,
        "detail": detail,
        "related_type": related_type,
        "related_id": related_id,
        "url": url,
        "action_label": action_label,
        "data": data or {},
    }
    created = []
    for user in resolve_recipients(module, prio, assignee_id=assignee_id, rule=rule):
        notif, was_created = _upsert(
            user,
            notif_type=notif_type,
            module=module,
            priority=prio,
            fields=fields,
            dedup_key=dedup_key,
            expires_at=expires_at,
            origin=NotifOrigin.AUTOMATIC,
            created_by=None,
        )
        if was_created:
            created.append(notif)
            if rule.send_email:
                _send_internal_email(user, title, message)
    return created


def create_manual(
    *,
    created_by,
    recipient_ids=None,
    role_key=None,
    notif_type=None,
    module=None,
    title,
    message,
    detail="",
    priority=NotifPriority.IMPORTANT,
    url="",
    expires_at=None,
):
    """Aviso manual enviado por um usuário autorizado a outros usuários/papéis."""
    from .models import NotifModule, NotifType

    User = get_user_model()
    users = User.objects.filter(is_active=True)
    targets = []
    if recipient_ids:
        targets.extend(users.filter(id__in=recipient_ids))
    if role_key:
        targets.extend(users.filter(role__key=role_key))
    # Dedup de destinatários preservando ordem.
    seen = set()
    unique = []
    for u in targets:
        if u.id not in seen:
            seen.add(u.id)
            unique.append(u)

    ntype = notif_type or NotifType.MANUAL
    nmodule = module or TYPE_MODULE.get(ntype, NotifModule.SYSTEM)
    created = []
    for user in unique:
        notif = Notification.objects.create(
            recipient=user,
            audience_role=getattr(user, "role", None),
            notif_type=ntype,
            module=nmodule,
            priority=priority,
            title=title,
            message=message,
            detail=detail,
            url=url,
            expires_at=expires_at,
            origin=NotifOrigin.MANUAL,
            created_by=(
                created_by if getattr(created_by, "is_authenticated", False) else None
            ),
        )
        created.append(notif)
    return created


# --- leitura / arquivamento ------------------------------------------------


def unread_count(user):
    return Notification.objects.filter(
        recipient=user, status=NotifStatus.UNREAD
    ).count()


def mark_read(user, ids=None):
    qs = Notification.objects.filter(recipient=user, status=NotifStatus.UNREAD)
    if ids is not None:
        qs = qs.filter(id__in=ids)
    return qs.update(status=NotifStatus.READ, read_at=timezone.now())


def mark_unread(notif):
    notif.status = NotifStatus.UNREAD
    notif.read_at = None
    notif.save(update_fields=["status", "read_at"])


def archive(notif):
    notif.status = NotifStatus.ARCHIVED
    if notif.read_at is None:
        notif.read_at = timezone.now()
    notif.save(update_fields=["status", "read_at"])
