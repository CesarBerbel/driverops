"""Serviços dos pedidos do site: eventos, notificação e conversões.

Converte um pedido validado em cliente, veículo, OS ou orçamento reaproveitando
os dados informados, respeitando as regras existentes do projeto. As conversões
que criam OS/orçamento passam por validações (cliente/veículo definidos,
divergência revisada) verificadas na camada de view.
"""

from datetime import date

from django.conf import settings as dj_settings
from django.core.mail import send_mail

from apps.customers.utils import only_digits
from apps.workshop.models import WorkshopProfile

from .models import LeadEvent, LeadSettings, LeadStatus


def record_event(lead, event_type, description="", *, actor=None, from_status="", to_status=""):
    LeadEvent.objects.create(
        lead=lead,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        event_type=event_type,
        description=description[:300],
        from_status=from_status,
        to_status=to_status,
    )


def set_status(lead, new_status, *, actor=None, description=""):
    if lead.status == new_status:
        return
    old = lead.status
    lead.status = new_status
    lead.save(update_fields=["status", "updated_at"])
    record_event(
        lead,
        LeadEvent.Type.STATUS,
        description or f"Status: {lead.get_status_display()}",
        actor=actor,
        from_status=old,
        to_status=new_status,
    )


# --- notificação / auto-resposta -------------------------------------------


def _workshop_name():
    p = WorkshopProfile.get_solo()
    return p.trade_name or p.legal_name or "a oficina"


def notify_new_lead(lead):
    """Registra o pedido, avisa a oficina (e-mail opcional) e responde o cliente."""
    record_event(lead, LeadEvent.Type.CREATED, "Pedido recebido pelo site.")
    conf = LeadSettings.get_solo()

    if conf.notify_email:
        profile = WorkshopProfile.get_solo()
        to = (profile.email or "").strip()
        if to:
            plate = lead.vehicle_plate or "sem veículo"
            send_mail(
                subject=f"Novo pedido do site — {lead.name}",
                message=(
                    f"Novo pedido vindo do site.\n\n"
                    f"Cliente: {lead.name}\nTelefone: {lead.phone}\n"
                    f"Veículo: {plate}\nSolicitação: {lead.get_request_type_display()}\n"
                    f"Período: {lead.get_best_period_display()}\n\n"
                    f"Mensagem: {lead.message or '-'}\n\n"
                    "Acesse o sistema para atender o pedido."
                ),
                from_email=dj_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[to],
                fail_silently=True,
            )

    if conf.auto_reply_enabled and lead.email:
        send_mail(
            subject=f"Recebemos o seu pedido — {_workshop_name()}",
            message=(
                f"Olá, {lead.name}.\n\n"
                f"Recebemos o seu pedido de atendimento"
                f"{f' para o veículo {lead.vehicle_plate}' if lead.vehicle_plate else ''}. "
                "Nossa equipe entrará em contato para confirmar as informações e combinar "
                "o melhor horário.\n\n"
                f"{_workshop_name()}"
            ),
            from_email=dj_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[lead.email],
            fail_silently=True,
        )
        record_event(lead, LeadEvent.Type.NOTIFY, f"Confirmação enviada para {lead.email}.")


# --- conversões ------------------------------------------------------------


def create_customer_from_lead(lead, *, actor):
    from rest_framework.exceptions import ValidationError

    from apps.customers.models import Customer
    from apps.customers.utils import find_customer_conflicts

    phone = only_digits(lead.phone)
    document = only_digits(lead.document)
    conflicts = find_customer_conflicts(phone=phone, whatsapp=phone, document=document)
    if conflicts:
        other = next(iter(conflicts.values()))
        raise ValidationError(
            {
                "detail": (
                    f"Já existe um cliente ({other.name}) com este telefone ou documento. "
                    "Use 'Vincular ao existente' em vez de criar um novo cadastro."
                ),
                "code": "customer_exists",
            }
        )

    customer = Customer.objects.create(
        name=lead.name,
        phone=phone,
        whatsapp=phone,
        email=lead.email or "",
        document=document,
        notes="Criado a partir de pedido vindo do site.",
    )
    lead.linked_customer = customer
    lead.save(update_fields=["linked_customer", "updated_at"])
    record_event(
        lead, LeadEvent.Type.CREATE_CUSTOMER, f"Cliente criado: {customer.name}.", actor=actor
    )
    return customer


def create_vehicle_from_lead(lead, *, actor, customer):
    from apps.vehicles.models import Vehicle

    vehicle = Vehicle.objects.create(
        customer=customer,
        license_plate=lead.vehicle_plate,
        brand=lead.vehicle_brand or "",
        model=lead.vehicle_model or "",
        model_year=lead.vehicle_year,
        mileage=lead.vehicle_mileage,
        notes="Criado a partir de pedido vindo do site.",
    )
    lead.linked_vehicle = vehicle
    lead.save(update_fields=["linked_vehicle", "updated_at"])
    record_event(
        lead,
        LeadEvent.Type.CREATE_VEHICLE,
        f"Veículo criado: {vehicle.license_plate}.",
        actor=actor,
    )
    return vehicle


def create_os_from_lead(lead, *, actor):
    """Cria a OS a partir do pedido (cliente e veículo já definidos)."""
    from apps.orders.history import record_event as os_record_event
    from apps.orders.models import OrderEvent, WorkOrder

    order = WorkOrder.objects.create(
        customer=lead.linked_customer,
        vehicle=lead.linked_vehicle,
        opened_at=date.today(),
        customer_report=lead.message or "Pedido recebido pelo site.",
        internal_notes=(
            f"Origem: pedido do site (#{lead.id}). "
            f"Solicitação: {lead.get_request_type_display()}."
        ),
    )
    os_record_event(order, OrderEvent.Type.CREATED, "OS criada a partir de pedido do site", actor=actor)
    lead.work_order = order
    lead.save(update_fields=["work_order", "updated_at"])
    record_event(
        lead,
        LeadEvent.Type.CONVERT_OS,
        f"OS #{order.number:04d} gerada.",
        actor=actor,
    )
    set_status(lead, LeadStatus.CONVERTED_OS, actor=actor)
    return order


def create_quote_from_lead(lead, *, actor):
    """Cria (se preciso) a OS e um orçamento a partir dela."""
    from apps.quotes.services import create_quote_from_order

    order = lead.work_order or create_os_from_lead(lead, actor=actor)
    quote = create_quote_from_order(order, user=actor if getattr(actor, "is_authenticated", False) else None)
    record_event(
        lead, LeadEvent.Type.CONVERT_QUOTE, f"Orçamento #{quote.number:04d} gerado.", actor=actor
    )
    set_status(lead, LeadStatus.CONVERTED_QUOTE, actor=actor)
    return quote
