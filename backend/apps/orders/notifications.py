"""Notificações ao cliente sobre a Ordem de Serviço.

Os conteúdos passam pelo **motor de templates** (:mod:`apps.notifications`): cada
gatilho resolve o template ativo do evento correspondente (com fallback seguro no
padrão de fábrica), renderiza as variáveis e envia. Cada envio bem-sucedido vira
um evento "Cliente notificado" na linha do tempo da OS.

Gatilhos automáticos (configuráveis em Configurações da OS):
- **abertura** → evento ``order_opened`` (``notify_on_creation``);
- **status** → evento mapeado por status (``notify_statuses``);
- **pagamento** → evento ``payment_received`` (``notify_on_payment``).

``notify_customer_by_email`` é o interruptor geral dos envios automáticos. O envio
manual (botão na OS) funciona independentemente.
"""

from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail

from apps.notifications.events import STATUS_EVENT_MAP
from apps.notifications.services import send_notification
from apps.workshop.models import OrderSettings, WorkshopProfile

from .history import record_event
from .models import OrderEvent


def _workshop_name() -> str:
    profile = WorkshopProfile.get_solo()
    return profile.trade_name or profile.legal_name or "a oficina"


def _record(order, to_email, label, actor, channel):
    record_event(
        order,
        OrderEvent.Type.CUSTOMER_NOTIFIED,
        f"{to_email} — {label}",
        actor=actor,
        channel=channel,
    )


def _notify_event(order, event_key, label, actor, channel, *, payment=None) -> str | None:
    """Envia um evento via motor de templates e registra na timeline se enviado."""
    result = send_notification(
        event_key,
        channel="email",
        work_order=order,
        payment=payment,
        actor=actor,
    )
    if result.ok and result.recipient:
        _record(order, result.recipient, label, actor, channel)
        return result.recipient
    return None


# --- fallback de status sem evento dedicado ----------------------------------


def _send_plain(order, subject: str, body: str) -> str | None:
    """Envio simples em texto (usado só para status sem evento dedicado)."""
    to_email = (order.customer.email or "").strip()
    if not to_email:
        return None
    message = (
        f"Olá, {order.customer.name}.\n\n"
        f"{body}\n\n"
        "Em caso de dúvidas, entre em contato com a oficina.\n\n"
        f"{_workshop_name()}"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
    )
    return to_email


def _os_ref(order) -> str:
    return f"nº {order.number:04d} ({order.vehicle.license_plate})"


# --- gatilhos individuais (usados manual/automaticamente) --------------------


def notify_status(order, actor=None, channel="E-mail") -> str | None:
    """Envia o status atual da OS ao cliente + registra o evento.

    Usa o template do evento mapeado pelo status; para status sem evento
    dedicado, cai num aviso genérico em texto.
    """
    status_display = order.get_status_display()
    event_key = STATUS_EVENT_MAP.get(order.status)
    if event_key:
        return _notify_event(order, event_key, status_display, actor, channel)
    subject = f"OS #{order.number:04d} - {status_display} - {_workshop_name()}"
    body = (
        f"Atualização da sua Ordem de Serviço {_os_ref(order)}:\n\n"
        f"Status: {status_display}."
    )
    to_email = _send_plain(order, subject, body)
    if to_email:
        _record(order, to_email, status_display, actor, channel)
    return to_email


def notify_created(order, actor=None, channel="E-mail (automático)") -> str | None:
    return _notify_event(order, "order_opened", "OS aberta", actor, channel)


def notify_payment(
    order, payment, actor=None, channel="E-mail (automático)"
) -> str | None:
    amount = f"R$ {Decimal(payment.amount)}".replace(".", ",")
    return _notify_event(
        order, "payment_received", f"Recibo {amount}", actor, channel, payment=payment
    )


# --- disparos automáticos (respeitam o interruptor geral + os gatilhos) ------


def _auto_enabled() -> OrderSettings | None:
    conf = OrderSettings.get_solo()
    return conf if conf.notify_customer_by_email else None


def maybe_notify_status_change(order, actor=None) -> str | None:
    conf = _auto_enabled()
    if conf is None or order.status not in (conf.notify_statuses or []):
        return None
    return notify_status(order, actor=actor, channel="E-mail (automático)")


def maybe_notify_created(order, actor=None) -> str | None:
    conf = _auto_enabled()
    if conf is None or not conf.notify_on_creation:
        return None
    return notify_created(order, actor=actor)


def maybe_notify_payment(order, payment, actor=None) -> str | None:
    conf = _auto_enabled()
    if conf is None or not conf.notify_on_payment:
        return None
    return notify_payment(order, payment, actor=actor)
