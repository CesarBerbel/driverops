"""Geração do PDF da Ordem de Serviço.

Reaproveita a mesma abordagem do PDF de orçamento (xhtml2pdf + logo embutido como
data URI reduzido com Pillow) e os **termos/rodapé** configurados em
[Configurações da OS]. Os totais/itens vêm do `WorkOrderSerializer` (fonte da
verdade no backend), então o PDF nunca diverge da tela.
"""

import base64
from collections import defaultdict
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


def _digits(value):
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _fmt_cnpj_cpf(value):
    """Formata CNPJ (14) ou CPF (11) a partir dos dígitos; devolve o original se
    não bater com nenhum dos dois tamanhos."""
    d = _digits(value)
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    return value or ""


def _fmt_phone(value):
    d = _digits(value)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return value or ""


def _fmt_cep(value):
    d = _digits(value)
    return f"{d[:5]}-{d[5:]}" if len(d) == 8 else (value or "")


def _workshop_address(profile):
    """Endereço da oficina em uma linha: rua, nº, complemento - bairro - cidade/UF - CEP."""
    line = profile.street or ""
    if profile.number:
        line += f", {profile.number}"
    if profile.complement:
        line += f" - {profile.complement}"
    if profile.neighborhood:
        line += f" - {profile.neighborhood}"
    parts = [line.strip(" -")]
    if profile.city:
        parts.append(
            f"{profile.city}/{profile.state}" if profile.state else profile.city
        )
    if profile.zip_code:
        parts.append(f"CEP {_fmt_cep(profile.zip_code)}")
    return " - ".join(p for p in parts if p)


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

    def _row(item, kind):
        return {
            "kind": kind,  # service | part_child | part | package
            "description": item["display_name"],
            "is_custom": item["is_custom"],
            "quantity": _fmt_qty(item["quantity"]),
            "unit_price": _brl(item["unit_price"]),
            "subtotal": _brl(item["line_total"]),
        }

    services = data["service_items"]
    packages = data["package_items"]
    parts = data["part_items"]

    # Peças agrupadas pelo serviço a que pertencem (linked_service_index = posição
    # na lista de serviços da OS). Peças sem vínculo entram como "avulsas".
    parts_by_service = defaultdict(list)
    orphan_parts = []
    for part in parts:
        index = part.get("linked_service_index")
        if isinstance(index, int) and 0 <= index < len(services):
            parts_by_service[index].append(part)
        else:
            orphan_parts.append(part)

    # Lista ÚNICA de itens (sem separar serviços x peças): cada serviço vem
    # seguido, indentado, das peças que o compõem; depois os pacotes; por fim as
    # peças avulsas. O nome do serviço vai junto na peça-filha para o vínculo
    # continuar claro mesmo se a tabela quebrar de página.
    line_rows = []
    for index, service in enumerate(services):
        line_rows.append(_row(service, "service"))
        for part in parts_by_service[index]:
            row = _row(part, "part_child")
            row["service_name"] = service["display_name"]
            line_rows.append(row)
    for package in packages:
        line_rows.append(_row(package, "package"))
    for part in orphan_parts:
        line_rows.append(_row(part, "part"))

    technician = None
    if order.assigned_technician_id:
        tech = order.assigned_technician
        technician = tech.full_name or tech.email

    return {
        "order": order,
        "profile": profile,
        "logo": _logo(profile.logo),
        # Dados institucionais da oficina, já formatados para o cabeçalho.
        "workshop": {
            "cnpj": _fmt_cnpj_cpf(profile.cnpj),
            "state_registration": profile.state_registration,
            "responsible": profile.responsible,
            "phone": _fmt_phone(profile.phone),
            "whatsapp": _fmt_phone(profile.whatsapp),
            "email": profile.email,
            "website": profile.website,
            "address": _workshop_address(profile),
            "business_hours": profile.business_hours,
        },
        "customer": order.customer,
        "customer_document": _fmt_cnpj_cpf(order.customer.document),
        "customer_phone": _fmt_phone(order.customer.phone or order.customer.whatsapp),
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
        "line_rows": line_rows,
        "has_items": bool(line_rows),
        "totals": {
            "services": _brl(data["services_total"]),
            "packages": _brl(data["packages_total"]),
            "parts": _brl(data["parts_total"]),
            "gross": _brl(data["gross_total"]),
            "final": _brl(data["final_value"]),
            "show_services": Decimal(data["services_total"]) > 0,
            "show_packages": Decimal(data["packages_total"]) > 0,
            "show_parts": Decimal(data["parts_total"]) > 0,
        },
        "has_discount": Decimal(data["final_value"]) < Decimal(data["gross_total"]),
        "discount": _brl(Decimal(data["gross_total"]) - Decimal(data["final_value"])),
        "payment": {
            "paid": _brl(data["amount_paid"]),
            "balance": _brl(data["balance_due"]),
            "status_display": PAYMENT_STATUS_LABEL.get(data["payment_status"], ""),
        },
        # Todos os termos aplicáveis à OS (só entram os preenchidos), na ordem em
        # que devem aparecer no rodapé. Antes o PDF só mostrava autorização +
        # condições gerais, deixando de fora garantia e ciência do cliente.
        "terms": [
            term
            for term in [
                {
                    "title": "Autorização de serviço",
                    "text": os_settings.service_authorization_terms,
                },
                {"title": "Garantia", "text": os_settings.warranty_terms},
                {"title": "Condições gerais", "text": os_settings.general_conditions},
                {
                    "title": "Ciência do cliente",
                    "text": os_settings.customer_acknowledgment_terms,
                },
            ]
            if (term["text"] or "").strip()
        ],
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
