"""Notificações ao cliente por e-mail sobre a Ordem de Serviço.

Fase 1 da frente de notificações: **somente e-mail** (WhatsApp fica para depois).
Envia um aviso ao cliente quando a OS chega a marcos relevantes (pronta para
entrega / finalizada), de forma automática (configurável em Configurações da OS)
ou manual (ação na tela da OS). Cada envio vira um evento na linha do tempo da OS.
"""

from django.conf import settings
from django.core.mail import send_mail

from apps.workshop.models import OrderSettings, WorkshopProfile

from .history import record_event
from .models import OrderEvent, WorkOrder

# Marcos que disparam o e-mail automático ao cliente.
NOTIFY_STATUSES = {WorkOrder.Status.READY, WorkOrder.Status.FINISHED}


def _workshop_name() -> str:
    profile = WorkshopProfile.get_solo()
    return profile.trade_name or profile.legal_name or "a oficina"


def send_order_status_email(order) -> str | None:
    """Envia ao cliente um e-mail com o status atual da OS.

    Devolve o e-mail de destino se enviou, ou ``None`` se o cliente não tem
    e-mail cadastrado.
    """
    customer = order.customer
    to_email = (customer.email or "").strip()
    if not to_email:
        return None

    workshop = _workshop_name()
    status_display = order.get_status_display()
    subject = f"OS #{order.number:04d} - {status_display} - {workshop}"
    message = (
        f"Olá, {customer.name}.\n\n"
        f"Atualização da sua Ordem de Serviço nº {order.number:04d} "
        f"({order.vehicle.license_plate}):\n\n"
        f"Status: {status_display}.\n\n"
        "Em caso de dúvidas, entre em contato com a oficina.\n\n"
        f"{workshop}"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
    )
    return to_email


def notify_customer(order, actor=None, channel="E-mail") -> str | None:
    """Envia o e-mail e registra o evento na timeline. Devolve o e-mail ou None."""
    to_email = send_order_status_email(order)
    if to_email:
        record_event(
            order,
            OrderEvent.Type.CUSTOMER_NOTIFIED,
            f"{to_email} — {order.get_status_display()}",
            actor=actor,
            channel=channel,
        )
    return to_email


def maybe_notify_status_change(order, actor=None) -> str | None:
    """Notifica automaticamente ao chegar num marco, se a configuração permitir."""
    if order.status not in NOTIFY_STATUSES:
        return None
    if not OrderSettings.get_solo().notify_customer_by_email:
        return None
    return notify_customer(order, actor=actor, channel="E-mail (automático)")
