"""Geração do PDF da Ordem de Serviço.

Reaproveita a mesma abordagem do PDF de orçamento (xhtml2pdf + logo embutido como
data URI reduzido com Pillow) e os **termos/rodapé** configurados em
[Configurações da OS]. Os totais/itens vêm do `WorkOrderSerializer` (fonte da
verdade no backend), então o PDF nunca diverge da tela.
"""

import base64
import re
from collections import defaultdict
from decimal import Decimal
from io import BytesIO

from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape
from xhtml2pdf import pisa

from apps.workshop.models import OrderSettings, PdfLayoutSettings, WorkshopProfile
from apps.workshop.pdf_blocks import (
    normalize_accent_color,
    normalize_base_font_size,
    normalize_blocks,
)

PAYMENT_STATUS_LABEL = {"open": "Em aberto", "partial": "Parcial", "paid": "Pago"}


def _even_widths(cells):
    """Distribui a largura das células igualmente (para tabelas tipo formulário
    com um número variável de colunas). Devolve as células com `width` definido."""
    if cells:
        width = f"{100 // len(cells)}%"
        for cell in cells:
            cell["width"] = width
    return cells


def _resolve_layout_blocks(blocks, data):
    """Transforma os blocos salvos (type + options) em blocos "prontos para
    renderizar", anexando os dados que cada tipo precisa (células do cliente,
    termos filtrados, etc.). O template apenas percorre a lista e imprime."""
    resolved = []
    for block in blocks:
        block_type = block["type"]
        options = block.get("options", {})
        rb = {"type": block_type, "options": options}
        if block_type == "customer":
            fields = options.get("fields") or []
            cells = [
                dict(data["customer_fields"][key], key=key)
                for key in fields
                if key in data["customer_fields"]
            ]
            rb["cells"] = _even_widths(cells)
        elif block_type == "dates":
            cells = [
                dict(cell)
                for flag, cell in data["dates_all"]
                if options.get(flag, True)
            ]
            rb["cells"] = _even_widths(cells)
        elif block_type == "terms":
            include = options.get("include") or []
            rb["terms"] = [t for t in data["terms"] if t["key"] in include]
        resolved.append(rb)
    return resolved


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


def _term_html(text):
    """Formata um termo para o PDF: quebra em linhas (respeita quebras reais e
    listas escritas em uma linha só, com " - ") e transforma cada item de lista
    em marcador "•". Escapa HTML e devolve seguro para inserir no template."""
    text = (text or "").strip()
    if not text:
        return ""
    # Listas escritas numa linha só: " - " vira quebra de linha antes do item.
    text = re.sub(r"\s+[-–]\s+", "\n- ", text.replace("\r\n", "\n"))
    parts = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line[0] in "-–":
            parts.append("• " + escape(line.lstrip("-– ").strip()))
        else:
            parts.append(escape(line))
    return "<br/>".join(parts)


def build_order_pdf_context(order, request=None, layout=None):
    from .serializers import WorkOrderSerializer

    profile = WorkshopProfile.get_solo()
    os_settings = OrderSettings.get_solo()
    # Layout do PDF (blocos). `layout` (dict) permite pré-visualizar alterações
    # ainda não salvas; sem ele, usa o layout persistido. Sempre normalizado.
    if layout is not None:
        blocks = normalize_blocks(layout.get("blocks"))
        accent_color = normalize_accent_color(layout.get("accent_color"))
        base_font_size = normalize_base_font_size(layout.get("base_font_size"))
    else:
        pdf_layout = PdfLayoutSettings.get_solo()
        blocks = normalize_blocks(pdf_layout.blocks)
        accent_color = normalize_accent_color(pdf_layout.accent_color)
        base_font_size = normalize_base_font_size(pdf_layout.base_font_size)
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
    # Código sequencial (1, 2, ...) por serviço; suas peças herdam o código do
    # serviço com um sufixo (1.1, 1.2, ...), deixando o vínculo explícito -- como
    # no modelo de OS impresso da oficina.
    line_rows = []
    service_no = 0
    for index, service in enumerate(services):
        service_no += 1
        srow = _row(service, "service")
        srow["code"] = str(service_no)
        line_rows.append(srow)
        part_no = 0
        for part in parts_by_service[index]:
            part_no += 1
            row = _row(part, "part_child")
            row["code"] = f"{service_no}.{part_no}"
            row["service_name"] = service["display_name"]
            line_rows.append(row)
    for package in packages:
        prow = _row(package, "package")
        prow["code"] = ""
        line_rows.append(prow)
    for part in orphan_parts:
        row = _row(part, "part")
        row["code"] = ""
        line_rows.append(row)

    technician = None
    if order.assigned_technician_id:
        tech = order.assigned_technician
        technician = tech.full_name or tech.email

    vehicle_info = {
        "model": " ".join(p for p in [vehicle.model, vehicle.version] if p),
        "fuel": vehicle.get_fuel_type_display() if vehicle.fuel_type else "",
        "transmission": (
            vehicle.get_transmission_display() if vehicle.transmission else ""
        ),
        "steering": vehicle.get_steering_display() if vehicle.steering else "",
        "doors": vehicle.doors or "",
        "air": (
            ""
            if vehicle.air_conditioning is None
            else ("Sim" if vehicle.air_conditioning else "Não")
        ),
    }
    vehicle_mileage = f"{mileage:,}".replace(",", ".") if mileage else ""

    # Ficha do veículo: só os campos PREENCHIDOS aparecem (campos vazios são
    # omitidos, em vez de virar "—"). A placa é a âncora e vem sempre.
    _vfields = [
        ("Placa", vehicle.license_plate, True),
        ("Fabricante", vehicle.brand, False),
        ("Modelo", vehicle_info["model"], False),
        ("Ano", year, False),
        ("KM", vehicle_mileage, False),
        ("Cor", vehicle.color, False),
        ("Combustível", vehicle_info["fuel"], False),
        ("Câmbio", vehicle_info["transmission"], False),
        ("Direção", vehicle_info["steering"], False),
        ("Portas", vehicle_info["doors"], False),
        ("Ar-cond.", vehicle_info["air"], False),
    ]
    vehicle_fields = [
        {"label": label, "value": str(value).strip(), "plate": is_plate}
        for label, value, is_plate in _vfields
        if value not in (None, "") and str(value).strip()
    ]
    _cols = 5
    vehicle_field_rows = [
        vehicle_fields[i : i + _cols] for i in range(0, len(vehicle_fields), _cols)
    ]
    if vehicle_field_rows:
        while len(vehicle_field_rows[-1]) < _cols:
            vehicle_field_rows[-1].append(None)

    customer_document = _fmt_cnpj_cpf(order.customer.document)
    customer_phone = _fmt_phone(order.customer.phone or order.customer.whatsapp)
    # Campos do cliente disponíveis para o bloco "Cliente" escolher quais mostrar.
    customer_fields = {
        "name": {"label": "Nome do cliente", "value": order.customer.name or "—"},
        "phone": {"label": "Telefone", "value": customer_phone or "—"},
        "email": {"label": "E-mail", "value": order.customer.email or "—"},
        "document": {"label": "CPF/CNPJ", "value": customer_document or "—"},
    }
    # Campos de data/técnico, cada um com o flag que o liga/desliga no bloco.
    dates_all = [
        (
            "show_opened",
            {"label": "Data de abertura", "value": _fmt_date(order.opened_at) or "—"},
        ),
        (
            "show_expected",
            {
                "label": "Previsão de entrega",
                "value": _fmt_date(order.expected_delivery) or "—",
            },
        ),
        (
            "show_technician",
            {"label": "Técnico responsável", "value": technician or "—"},
        ),
    ]
    # Termos com chave estável (o bloco "Termos" filtra por essas chaves).
    terms = [
        {"key": term["key"], "title": term["title"], "html": _term_html(term["text"])}
        for term in [
            {
                "key": "authorization",
                "title": "Autorização de serviço",
                "text": os_settings.service_authorization_terms,
            },
            {
                "key": "warranty",
                "title": "Garantia",
                "text": os_settings.warranty_terms,
            },
            {
                "key": "general",
                "title": "Condições gerais",
                "text": os_settings.general_conditions,
            },
            {
                "key": "acknowledgment",
                "title": "Ciência do cliente",
                "text": os_settings.customer_acknowledgment_terms,
            },
        ]
        if (term["text"] or "").strip()
    ]

    layout_blocks = _resolve_layout_blocks(
        blocks,
        {
            "customer_fields": customer_fields,
            "dates_all": dates_all,
            "terms": terms,
        },
    )

    return {
        "order": order,
        "profile": profile,
        "logo": _logo(profile.logo),
        # Layout por blocos e aparência (cor de destaque, corpo do texto).
        "layout_blocks": layout_blocks,
        "page": {"accent_color": accent_color, "base_font_size": base_font_size},
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
        "customer_document": customer_document,
        "customer_phone": customer_phone,
        "vehicle": vehicle,
        "vehicle_description": " ".join(
            p for p in [vehicle.brand, vehicle.model] if p
        ).strip(),
        "vehicle_year": year,
        "vehicle_mileage": vehicle_mileage,
        # Ficha do veículo (só campos preenchidos), já em linhas de 5 colunas.
        "vehicle_info": vehicle_info,
        "vehicle_field_rows": vehicle_field_rows,
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
        # Todos os termos aplicáveis à OS (só entram os preenchidos). O bloco
        # "Termos" do layout escolhe quais destes de fato aparecem.
        "terms": terms,
        "footer_text": os_settings.pdf_footer_text,
    }


def render_order_pdf(order, request=None, layout=None):
    """Gera o PDF da OS (bytes). Nunca quebra por termo/logo ausente.

    `layout` (dict opcional) permite renderizar com um layout ainda não salvo,
    usado pela pré-visualização do construtor de PDF.
    """
    html = render_to_string(
        "orders/order_pdf.html", build_order_pdf_context(order, request, layout=layout)
    )
    buffer = BytesIO()
    pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    return buffer.getvalue()
