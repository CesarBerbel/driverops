"""Notificações ao cliente por e-mail sobre a Ordem de Serviço.

Frente de notificações: **somente e-mail** (WhatsApp fora de escopo). Avisa o
cliente em vários gatilhos, todos configuráveis em Configurações da OS:

- **status**: ao a OS atingir um dos status escolhidos (`notify_statuses`);
- **abertura**: ao criar a OS (`notify_on_creation`);
- **pagamento**: ao registrar um pagamento -- recibo (`notify_on_payment`).

`notify_customer_by_email` é o interruptor geral dos envios automáticos. O envio
manual (botão na OS) funciona independentemente. Cada envio vira um evento
"Cliente notificado por e-mail" na linha do tempo da OS.
"""

from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail

from apps.workshop.models import OrderSettings, WorkshopProfile

from .history import record_event
from .models import OrderEvent


def _workshop_name() -> str:
    profile = WorkshopProfile.get_solo()
    return profile.trade_name or profile.legal_name or "a oficina"


def _send(order, subject: str, body: str) -> str | None:
    """Envia um e-mail ao cliente da OS. Devolve o e-mail, ou None se não houver."""
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


def _record(order, to_email, label, actor, channel):
    record_event(
        order,
        OrderEvent.Type.CUSTOMER_NOTIFIED,
        f"{to_email} — {label}",
        actor=actor,
        channel=channel,
    )


def _os_ref(order) -> str:
    return f"nº {order.number:04d} ({order.vehicle.license_plate})"


# --- gatilhos individuais (usados manual/automaticamente) ---


def notify_status(order, actor=None, channel="E-mail") -> str | None:
    """Envia o status atual da OS ao cliente + registra o evento."""
    status_display = order.get_status_display()
    subject = f"OS #{order.number:04d} - {status_display} - {_workshop_name()}"
    body = (
        f"Atualização da sua Ordem de Serviço {_os_ref(order)}:\n\n"
        f"Status: {status_display}."
    )
    to_email = _send(order, subject, body)
    if to_email:
        _record(order, to_email, status_display, actor, channel)
    return to_email


def notify_created(order, actor=None, channel="E-mail (automático)") -> str | None:
    subject = f"OS #{order.number:04d} aberta - {_workshop_name()}"
    body = (
        f"Sua Ordem de Serviço {_os_ref(order)} foi aberta.\n"
        "Vamos acompanhar o andamento e avisá-lo sobre as próximas etapas."
    )
    to_email = _send(order, subject, body)
    if to_email:
        _record(order, to_email, "OS aberta", actor, channel)
    return to_email


def notify_payment(
    order, payment, actor=None, channel="E-mail (automático)"
) -> str | None:
    amount = f"R$ {Decimal(payment.amount)}".replace(".", ",")
    subject = f"OS #{order.number:04d} - Pagamento recebido - {_workshop_name()}"
    body = (
        f"Recebemos o pagamento de {amount} ({payment.get_method_display()}) "
        f"referente à Ordem de Serviço {_os_ref(order)}."
    )
    to_email = _send(order, subject, body)
    if to_email:
        _record(order, to_email, f"Recibo {amount}", actor, channel)
    return to_email


# --- disparos automáticos (respeitam o interruptor geral + os gatilhos) ---


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
