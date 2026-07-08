"""Geração do PDF da Ordem de Serviço.

Reaproveita a mesma abordagem do PDF de orçamento (xhtml2pdf + logo embutido como
data URI reduzido com Pillow) e os **termos/rodapé** configurados em
[Configurações da OS]. Os totais/itens vêm do `WorkOrderSerializer` (fonte da
verdade no backend), então o PDF nunca diverge da tela.
"""

import base64
from decimal import Decimal
from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone
from xhtml2pdf import pisa

from apps.workshop.models import OrderSettings, WorkshopProfile

PAYMENT_STATUS_LABEL = {"open": "Em aberto", "partial": "Parcial", "paid": "Pago"}


def _read_bytes(filefield):
    if not filefield:
        return None, None
    try:
        filefield.open("rb")
        data = filefield.read()
        filefield.close()
    except (FileNotFoundError, ValueError, OSError):
        return None, None
    ext = filefield.name.rsplit(".", 1)[-1].lower() if "." in filefield.name else "png"
    return data, ext


def _logo(filefield, max_w=90, max_h=45):
    """Logo reduzido (~90x45) e embutido como data URI -- mesmo motivo do orçamento."""
    data, ext = _read_bytes(filefield)
    if data is None:
        return None
    try:
        from PIL import Image

        with Image.open(BytesIO(data)) as img:
            img = img.convert("RGBA") if img.mode in ("P", "LA") else img.convert("RGB")
            img.thumbnail((max_w, max_h))
            buffer = BytesIO()
            fmt = "PNG" if img.mode == "RGBA" else "JPEG"
            img.save(buffer, format=fmt)
            resized = buffer.getvalue()
        mime = "png" if fmt == "PNG" else "jpeg"
        return f"data:image/{mime};base64," + base64.b64encode(resized).decode("ascii")
    except Exception:
        mime = "jpeg" if ext in ("jpg", "jpeg") else ext
        return f"data:image/{mime};base64," + base64.b64encode(data).decode("ascii")


def _fmt_date(value):
    return value.strftime("%d/%m/%Y") if value else ""


def _fmt_datetime(value):
    return timezone.localtime(value).strftime("%d/%m/%Y %H:%M") if value else ""


def _brl(value):
    number = Decimal(str(value or 0))
    text = f"{number:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {text}"


def _fmt_qty(value):
    number = Decimal(str(value or 0))
    text = f"{number:.2f}".rstrip("0").rstrip(".")
    return text.replace(".", ",") or "0"


def build_order_pdf_context(order, request=None):
    from .serializers import WorkOrderSerializer

    profile = WorkshopProfile.get_solo()
    os_settings = OrderSettings.get_solo()
    data = WorkOrderSerializer(
        order, context={"request": request} if request else {}
    ).data

    vehicle = order.vehicle
    year = ""
    if vehicle.manufacture_year or vehicle.model_year:
        year = f"{vehicle.manufacture_year or ''}/{vehicle.model_year or ''}".strip("/")
    mileage = order.current_mileage or vehicle.mileage

    def group(key):
        return [
            {
                "description": item["display_name"],
                "is_custom": item["is_custom"],
                "quantity": _fmt_qty(item["quantity"]),
                "unit_price": _brl(item["unit_price"]),
                "subtotal": _brl(item["line_total"]),
            }
            for item in data[key]
        ]

    groups = [
        {"title": "Serviços", "items": group("service_items")},
        {"title": "Pacotes", "items": group("package_items")},
        {"title": "Peças", "items": group("part_items")},
    ]

    technician = None
    if order.assigned_technician_id:
        tech = order.assigned_technician
        technician = tech.full_name or tech.email

    return {
        "order": order,
        "profile": profile,
        "logo": _logo(profile.logo),
        "customer": order.customer,
        "vehicle": vehicle,
        "vehicle_description": " ".join(
            p for p in [vehicle.brand, vehicle.model] if p
        ).strip(),
        "vehicle_year": year,
        "vehicle_mileage": f"{mileage:,}".replace(",", ".") if mileage else "",
        "status_display": order.get_status_display(),
        "technician": technician,
        "opened_at": _fmt_date(order.opened_at),
        "expected_delivery": _fmt_date(order.expected_delivery),
        "emitted_at": _fmt_datetime(timezone.now()),
        "customer_report": order.customer_report,
        "diagnosis": order.diagnosis,
        "groups": [g for g in groups if g["items"]],
        "totals": {
            "services": _brl(data["services_total"]),
            "packages": _brl(data["packages_total"]),
            "parts": _brl(data["parts_total"]),
            "gross": _brl(data["gross_total"]),
            "final": _brl(data["final_value"]),
        },
        "has_discount": Decimal(data["final_value"]) < Decimal(data["gross_total"]),
        "discount": _brl(Decimal(data["gross_total"]) - Decimal(data["final_value"])),
        "payment": {
            "paid": _brl(data["amount_paid"]),
            "balance": _brl(data["balance_due"]),
            "status_display": PAYMENT_STATUS_LABEL.get(data["payment_status"], ""),
        },
        "service_authorization_terms": os_settings.service_authorization_terms,
        "general_conditions": os_settings.general_conditions,
        "footer_text": os_settings.pdf_footer_text,
    }


def render_order_pdf(order, request=None):
    """Gera o PDF da OS (bytes). Nunca quebra por termo/logo ausente."""
    html = render_to_string(
        "orders/order_pdf.html", build_order_pdf_context(order, request)
    )
    buffer = BytesIO()
    pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    return buffer.getvalue()
