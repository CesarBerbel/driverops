import base64
from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone
from xhtml2pdf import pisa

from apps.workshop.models import OrderSettings, WorkshopProfile

from .calc import compute_totals, format_brl, item_subtotal


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


def _data_uri(filefield):
    """Lê um arquivo de imagem e devolve como data URI base64 (embutido no PDF)."""
    data, ext = _read_bytes(filefield)
    if data is None:
        return None
    mime = "jpeg" if ext in ("jpg", "jpeg") else ext
    return f"data:image/{mime};base64," + base64.b64encode(data).decode("ascii")


def _logo(filefield, max_w=90, max_h=45):
    """Logo já **redimensionado** para caber em ~90x45, embutido como data URI.

    xhtml2pdf não escala imagens data-URI de forma confiável (ignora max-width e
    chega a descartá-las quando width/height são forçados). Por isso o logo é
    reduzido aqui com Pillow, preservando a proporção -- o tamanho natural da
    imagem já é pequeno, mantendo o cabeçalho compacto e o PDF leve.
    """
    data, ext = _read_bytes(filefield)
    if data is None:
        return None
    try:
        from io import BytesIO

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
        # Sem Pillow/erro de decodificação: embute o original (fallback).
        mime = "jpeg" if ext in ("jpg", "jpeg") else ext
        return f"data:image/{mime};base64," + base64.b64encode(data).decode("ascii")


def _fmt_date(value):
    return value.strftime("%d/%m/%Y") if value else ""


def _fmt_datetime(value):
    return timezone.localtime(value).strftime("%d/%m/%Y %H:%M") if value else ""


def _fmt_qty(value):
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


# Texto complementar exigido quando a aprovação é parcial.
PARTIAL_APPROVAL_TERM = (
    "Declaro estar ciente de que autorizo a execução apenas dos itens marcados "
    "como aprovados neste orçamento. Os itens recusados não serão executados sem "
    "nova autorização."
)


def _fmt_item(item):
    return {
        "description": item.description,
        "kind_display": item.get_kind_display(),
        "is_custom": item.is_custom,
        "quantity": _fmt_qty(item.quantity or 0),
        "unit_price": format_brl(item.unit_price or 0),
        "subtotal": format_brl(item_subtotal(item)),
        "notes": item.notes,
        "status": item.status,
        "status_display": item.get_status_display(),
    }


def build_quote_pdf_context(quote, request=None):
    profile = WorkshopProfile.get_solo()
    os_settings = OrderSettings.get_solo()
    totals = compute_totals(quote)
    items = list(quote.items.all())
    order = quote.work_order
    vehicle = order.vehicle
    customer = order.customer

    decided = quote.status in ("partially_approved", "approved", "rejected")
    year = ""
    if vehicle.manufacture_year or vehicle.model_year:
        year = f"{vehicle.manufacture_year or ''}/{vehicle.model_year or ''}".strip("/")
    mileage = vehicle.mileage or order.current_mileage

    return {
        "quote": quote,
        "profile": profile,
        "logo": _logo(profile.logo),
        "signature": _data_uri(quote.signature_image),
        "customer": customer,
        "vehicle": vehicle,
        "vehicle_description": " ".join(
            p for p in [vehicle.brand, vehicle.model] if p
        ).strip(),
        "vehicle_year": year,
        "vehicle_mileage": f"{mileage:,}".replace(",", ".") if mileage else "",
        "decided": decided,
        "is_partial": quote.status == "partially_approved",
        "is_rejected": quote.status == "rejected",
        "partial_term": PARTIAL_APPROVAL_TERM,
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
