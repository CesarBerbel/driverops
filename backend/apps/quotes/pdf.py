import base64
from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone
from xhtml2pdf import pisa

from apps.workshop.models import OrderSettings, WorkshopProfile

from .calc import compute_totals, format_brl, item_subtotal


def _data_uri(filefield):
    """Lê um arquivo de imagem e devolve como data URI base64 (embutido no PDF)."""
    if not filefield:
        return None
    try:
        filefield.open("rb")
        data = filefield.read()
        filefield.close()
    except (FileNotFoundError, ValueError, OSError):
        return None
    ext = filefield.name.rsplit(".", 1)[-1].lower() if "." in filefield.name else "png"
    mime = "jpeg" if ext in ("jpg", "jpeg") else ext
    return f"data:image/{mime};base64," + base64.b64encode(data).decode("ascii")


def _fmt_date(value):
    return value.strftime("%d/%m/%Y") if value else ""


def _fmt_datetime(value):
    return timezone.localtime(value).strftime("%d/%m/%Y %H:%M") if value else ""


def _fmt_qty(value):
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


def _fmt_item(item):
    return {
        "description": item.description,
        "kind_display": item.get_kind_display(),
        "is_custom": item.is_custom,
        "quantity": _fmt_qty(item.quantity or 0),
        "unit_price": format_brl(item.unit_price or 0),
        "subtotal": format_brl(item_subtotal(item)),
        "notes": item.notes,
    }


def build_quote_pdf_context(quote, request=None):
    profile = WorkshopProfile.get_solo()
    os_settings = OrderSettings.get_solo()
    totals = compute_totals(quote)
    items = list(quote.items.all())
    order = quote.work_order
    vehicle = order.vehicle
    customer = order.customer

    return {
        "quote": quote,
        "profile": profile,
        "logo": _data_uri(profile.logo),
        "signature": _data_uri(quote.signature_image),
        "customer": customer,
        "vehicle": vehicle,
        "vehicle_description": " ".join(
            p for p in [vehicle.brand, vehicle.model] if p
        ).strip(),
        "groups": [
            {
                "title": "Serviços",
                "items": [_fmt_item(i) for i in items if i.kind == "service"],
            },
            {
                "title": "Pacotes",
                "items": [_fmt_item(i) for i in items if i.kind == "package"],
            },
            {
                "title": "Peças",
                "items": [_fmt_item(i) for i in items if i.kind == "part"],
            },
        ],
        "totals": {key: format_brl(value) for key, value in totals.items()},
        "has_discount": quote.discount_type != "none" and totals["discount_value"] > 0,
        "emitted_at": _fmt_datetime(quote.created_at),
        "valid_until": _fmt_date(quote.valid_until),
        "decided_at": _fmt_datetime(quote.decided_at),
        "quote_terms": os_settings.quote_terms,
        "warranty_terms": os_settings.warranty_terms,
        "service_authorization_terms": os_settings.service_authorization_terms,
        "footer_text": os_settings.pdf_footer_text,
    }


def render_quote_pdf(quote, request=None):
    """Gera o PDF do orçamento (bytes). Nunca quebra por termo/logo ausente."""
    html = render_to_string(
        "quotes/quote_pdf.html", build_quote_pdf_context(quote, request)
    )
    buffer = BytesIO()
    pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    return buffer.getvalue()
