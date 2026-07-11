"""Regras do portal do cliente: emissão de link, e-mail e payload SEGURO.

Toda filtragem de visibilidade acontece AQUI (backend). O frontend público nunca
recebe dados internos (observações internas, custo de peças, margem, etc.).
"""

import logging
import re
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.core.money import apply_discount
from apps.orders.models import WorkOrder
from apps.orders.serializers import line_total, money
from apps.workshop.models import WorkshopProfile

from .models import (
    CustomerPortalSettings,
    VehicleAccessToken,
    hash_token,
)

logger = logging.getLogger("apps.customer_portal")

# Status de OS considerados terminais (não é a "OS atual").
TERMINAL_STATUSES = {"finished", "canceled", "rejected"}


def normalize_plate(raw: str) -> str:
    """Placa/matrícula normalizada para comparação: só A-Z0-9, maiúsculas."""
    return re.sub(r"[^A-Za-z0-9]", "", raw or "").upper()


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def request_access(*, plate, email, request):
    """Fluxo neutro de solicitação de link. NÃO revela se o veículo existe.

    Só envia o link se: portal ativo, veículo com a placa existe, cliente tem
    e-mail, (e o e-mail informado bate, quando exigido) e não está em cooldown.
    Retorna sempre None -- a view responde a mesma mensagem neutra em qualquer
    caso.
    """
    conf = CustomerPortalSettings.get_solo()
    if not conf.enabled:
        return

    normalized = normalize_plate(plate)
    if not normalized:
        return

    # Comparação por placa normalizada (o banco pode ter formatação/caixa variada).
    vehicle = next(
        (
            v
            for v in _vehicles_by_plate(normalized)
            if normalize_plate(v.license_plate) == normalized
        ),
        None,
    )
    if vehicle is None:
        return

    customer = vehicle.customer
    dest_email = (customer.email or "").strip()
    if not dest_email:
        return
    # Quando o portal exige e-mail, ele precisa bater com o cadastrado.
    if conf.require_email and (email or "").strip().lower() != dest_email.lower():
        return

    # Cooldown: evita reenvio em rajada para a mesma placa (anti-abuso).
    recent = (
        VehicleAccessToken.objects.filter(vehicle=vehicle)
        .order_by("-created_at")
        .first()
    )
    if recent is not None:
        elapsed = (timezone.now() - recent.created_at).total_seconds()
        if elapsed < conf.resend_cooldown_seconds:
            return

    token_obj, raw = VehicleAccessToken.issue(
        customer=customer,
        vehicle=vehicle,
        email=dest_email,
        validity_hours=conf.link_validity_hours,
        request_ip=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )
    _send_access_email(token_obj, raw)
    logger.info("customer_portal: link emitido (veículo=%s)", vehicle.id)


def _vehicles_by_plate(normalized):
    # Filtro amplo por prefixo/igualdade indexada; o match exato normalizado é
    # feito em Python (para tolerar máscaras diferentes gravadas).
    from apps.vehicles.models import Vehicle

    return Vehicle.objects.select_related("customer").filter(
        license_plate__icontains=normalized[:7]
    )[:20]


def _send_access_email(token_obj, raw):
    profile = WorkshopProfile.get_solo()
    shop = profile.trade_name or profile.legal_name or "Oficina"
    link = f"{settings.FRONTEND_URL}/veiculo/{raw}"
    first_name = (token_obj.customer.name or "").split(" ")[0] or "Olá"
    hours = CustomerPortalSettings.get_solo().link_validity_hours
    subject = f"Acesso à consulta do seu veículo - {shop}"
    body = (
        f"Olá, {first_name}.\n\n"
        f"Recebemos uma solicitação para consultar as informações do seu veículo "
        f"na {shop}.\n\n"
        "Acesse a área segura do veículo pelo link abaixo. Ele é temporário e "
        "pessoal -- não o compartilhe:\n\n"
        f"{link}\n\n"
        f"O link expira em {hours} hora(s).\n"
        "Se você não solicitou este acesso, ignore esta mensagem.\n"
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[token_obj.email],
        )
    except Exception:  # pragma: no cover - falha de SMTP não deve vazar 500
        logger.exception("customer_portal: falha ao enviar e-mail de acesso")


# --- Payload seguro da área do veículo -----------------------------------------


def _order_total(order):
    # Mesma regra do serializer da OS (fonte única do desconto).
    gross = money(
        sum(
            (
                line_total(i)
                for i in [
                    *order.service_items.all(),
                    *order.package_items.all(),
                    *order.part_items.all(),
                ]
            ),
            Decimal("0"),
        )
    )
    return money(
        gross - apply_discount(gross, order.discount_type, order.discount_value)
    )


def _order_summary(order):
    return {
        "id": order.id,
        "number": order.number,
        "opened_at": order.opened_at.isoformat() if order.opened_at else None,
        "status": order.status,
        "status_display": order.get_status_display(),
        "final_value": str(_order_total(order)),
    }


def _timeline(order):
    # Da mais antiga para a mais nova (histórico vem desc por padrão). Só dados
    # visíveis ao cliente -- nada de notas internas.
    entries = list(order.status_history.all())
    entries.reverse()
    return [
        {
            "status": e.to_status,
            "status_display": dict(WorkOrder.Status.choices).get(
                e.to_status, e.to_status
            ),
            "at": e.created_at.isoformat(),
        }
        for e in entries
    ]


def _current_quote(order):
    quotes = [q for q in order.quotes.all() if q.status != "canceled"]
    if not quotes:
        return None
    quote = max(quotes, key=lambda q: q.number)
    return {
        "number": quote.number,
        "status": quote.status,
        "status_display": quote.get_status_display(),
        # Aprovação continua pelo fluxo público seguro já existente do orçamento.
        "approval_url": f"{settings.FRONTEND_URL}/orcamento/{quote.public_token}",
    }


def _order_detail(order, *, allow_pdf):
    return {
        **_order_summary(order),
        "expected_delivery": (
            order.expected_delivery.isoformat() if order.expected_delivery else None
        ),
        "customer_report": order.customer_report,
        "diagnosis": order.diagnosis,
        # internal_notes NUNCA entra no payload público.
        "updated_at": order.updated_at.isoformat(),
        "timeline": _timeline(order),
        "quote": _current_quote(order),
        "has_pdf": allow_pdf,
    }


def build_portal_payload(token_obj):
    conf = CustomerPortalSettings.get_solo()
    vehicle = token_obj.vehicle
    orders = list(
        WorkOrder.objects.filter(vehicle=vehicle)
        .prefetch_related(
            "status_history",
            "quotes",
            "service_items",
            "package_items",
            "part_items",
        )
        .order_by("-number")
    )
    current = next((o for o in orders if o.status not in TERMINAL_STATUSES), None)
    history = [o for o in orders if o is not current]

    profile = WorkshopProfile.get_solo()
    year = ""
    if vehicle.manufacture_year or vehicle.model_year:
        year = f"{vehicle.manufacture_year or ''}/{vehicle.model_year or ''}".strip("/")

    return {
        "vehicle": {
            "plate": vehicle.license_plate,
            "brand": vehicle.brand,
            "model": " ".join(p for p in [vehicle.model, vehicle.version] if p),
            "year": year,
            "color": vehicle.color,
            "mileage": vehicle.mileage,
        },
        "customer_first_name": (token_obj.customer.name or "").split(" ")[0],
        "current_order": (
            _order_detail(current, allow_pdf=conf.allow_pdf_download)
            if current
            else None
        ),
        "history": [_order_summary(o) for o in history] if conf.show_history else [],
        "workshop": {
            "name": profile.trade_name or profile.legal_name or "Oficina",
            "whatsapp": profile.whatsapp or profile.phone,
            "phone": profile.phone,
        },
        "options": {
            "allow_messages": conf.allow_messages,
            "allow_pdf_download": conf.allow_pdf_download,
            "show_history": conf.show_history,
        },
    }


def resolve_token(raw):
    """Devolve o VehicleAccessToken pelo valor bruto (via hash), ou None."""
    if not raw:
        return None
    return (
        VehicleAccessToken.objects.select_related("customer", "vehicle")
        .filter(token_hash=hash_token(raw))
        .first()
    )
