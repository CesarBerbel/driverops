"""Catálogo de variáveis dinâmicas dos templates e montagem de contexto.

As variáveis usam a sintaxe ``{{grupo.chave}}`` (ex.: ``{{cliente.nome}}``) e são
apresentadas na interface agrupadas por categoria, com rótulo legível e um
exemplo de valor. No momento do envio, :func:`build_context` resolve cada chave
com dados reais do contexto (OS, orçamento, pagamento) mais os dados da oficina.

Regras:
- toda chave presente no template DEVE existir neste catálogo (validado ao salvar);
- valores ausentes resolvem para string vazia (nunca quebram a renderização);
- grupos não aplicáveis ao contexto ainda existem no catálogo, apenas resolvem
  vazio -- assim o mesmo catálogo serve a todos os eventos.
"""

from decimal import Decimal

from django.conf import settings

from apps.customers.utils import only_digits
from apps.orders.serializers import line_total, money
from apps.quotes.calc import compute_totals, format_brl

# --- formatadores brasileiros -------------------------------------------------


def format_phone(raw):
    digits = only_digits(raw or "")
    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
    return digits


def format_cpf(digits):
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def format_cnpj(digits):
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def format_document(raw):
    digits = only_digits(raw or "")
    if len(digits) == 11:
        return format_cpf(digits)
    if len(digits) == 14:
        return format_cnpj(digits)
    return digits


def format_date(value):
    if not value:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _address(obj):
    """Monta um endereço de linha única a partir dos campos padrão."""
    parts = []
    street = getattr(obj, "street", "")
    number = getattr(obj, "number", "")
    if street:
        parts.append(f"{street}, {number}".strip().rstrip(","))
    for attr in ("neighborhood", "city"):
        value = getattr(obj, attr, "")
        if value:
            parts.append(value)
    state = getattr(obj, "state", "")
    if state:
        parts.append(state)
    return " - ".join(p for p in parts if p)


# --- catálogo apresentado na interface ---------------------------------------
# Cada grupo: (chave, rótulo, [(chave_variavel, rótulo, exemplo)])
VARIABLE_GROUPS = [
    (
        "oficina",
        "Dados da oficina",
        [
            ("oficina.nome", "Nome da oficina", "Auto Center Silva"),
            ("oficina.cnpj", "CNPJ / NIF", "12.345.678/0001-90"),
            ("oficina.telefone", "Telefone", "(11) 3555-1234"),
            ("oficina.whatsapp", "WhatsApp", "(11) 98765-4321"),
            ("oficina.email", "E-mail", "contato@autocentersilva.com.br"),
            ("oficina.endereco", "Endereço", "Rua das Oficinas, 100 - Centro - São Paulo - SP"),
            ("oficina.site", "Site", "www.autocentersilva.com.br"),
            ("oficina.logo", "Logo (URL)", "https://.../logo.png"),
            ("oficina.horario_funcionamento", "Horário de funcionamento", "Seg a Sex, 8h às 18h"),
        ],
    ),
    (
        "cliente",
        "Dados do cliente",
        [
            ("cliente.nome", "Nome", "João da Silva"),
            ("cliente.primeiro_nome", "Primeiro nome", "João"),
            ("cliente.email", "E-mail", "joao@email.com"),
            ("cliente.telefone", "Telefone", "(11) 98888-7777"),
            ("cliente.documento", "Documento", "123.456.789-00"),
            ("cliente.tipo", "Tipo de cliente", "Pessoa física"),
        ],
    ),
    (
        "veiculo",
        "Dados do veículo",
        [
            ("veiculo.placa", "Placa / matrícula", "ABC1D23"),
            ("veiculo.marca", "Marca", "Volkswagen"),
            ("veiculo.modelo", "Modelo", "Gol"),
            ("veiculo.versao", "Versão", "1.6 MSI"),
            ("veiculo.ano", "Ano", "2020"),
            ("veiculo.cor", "Cor", "Prata"),
            ("veiculo.quilometragem", "Quilometragem", "85.000 km"),
            ("veiculo.chassi", "Chassi", "9BWZZZ377VT004251"),
        ],
    ),
    (
        "ordem_servico",
        "Dados da ordem de serviço",
        [
            ("ordem_servico.numero", "Número da OS", "0042"),
            ("ordem_servico.status", "Status atual", "Pronta para entrega"),
            ("ordem_servico.data_abertura", "Data de abertura", "08/07/2026"),
            ("ordem_servico.data_prevista", "Data prevista de entrega", "12/07/2026"),
            ("ordem_servico.relato_cliente", "Relato do cliente", "Barulho na suspensão"),
            ("ordem_servico.diagnostico", "Diagnóstico", "Bieletas desgastadas"),
            ("ordem_servico.observacoes", "Observações", "Cliente pediu revisão dos freios"),
            ("ordem_servico.servicos", "Serviços vinculados", "Troca de bieletas; Alinhamento"),
            ("ordem_servico.pecas", "Peças vinculadas", "Par de bieletas dianteiras"),
            ("ordem_servico.valor_total", "Valor total estimado", "R$ 780,00"),
            ("ordem_servico.link_portal", "Link do portal do cliente", "https://.../os/42"),
        ],
    ),
    (
        "orcamento",
        "Dados do orçamento",
        [
            ("orcamento.numero", "Número do orçamento", "0031"),
            ("orcamento.status", "Status do orçamento", "Enviado"),
            ("orcamento.valor_total", "Valor total", "R$ 780,00"),
            ("orcamento.valor_aprovado", "Valor aprovado", "R$ 600,00"),
            ("orcamento.valor_pendente", "Valor pendente", "R$ 180,00"),
            ("orcamento.itens_aprovados", "Itens aprovados", "Troca de bieletas"),
            ("orcamento.itens_recusados", "Itens recusados", "Alinhamento"),
            ("orcamento.prazo_validade", "Prazo de validade", "15/07/2026"),
            ("orcamento.link_aprovacao", "Link de aprovação", "https://.../orcamento/token"),
            ("orcamento.link_pdf", "Link de visualização em PDF", "https://.../orcamento/token"),
        ],
    ),
    (
        "financeiro",
        "Dados financeiros",
        [
            ("financeiro.valor_aberto", "Valor em aberto", "R$ 180,00"),
            ("financeiro.valor_pago", "Valor pago", "R$ 600,00"),
            ("financeiro.forma_pagamento", "Forma de pagamento", "PIX"),
            ("financeiro.data_vencimento", "Data de vencimento", "12/07/2026"),
            ("financeiro.link_pagamento", "Link de pagamento", "https://.../pagar/42"),
        ],
    ),
]

# Conjunto de todas as chaves válidas (para validação ao salvar).
ALL_VARIABLE_KEYS = frozenset(
    key for _g, _label, variables in VARIABLE_GROUPS for key, _l, _ex in variables
)

# Exemplos por chave (usados na pré-visualização com "dados simulados").
SAMPLE_VALUES = {
    key: example
    for _g, _label, variables in VARIABLE_GROUPS
    for key, _l, example in variables
}


def variable_catalog():
    """Estrutura serializável do catálogo, para a interface montar a paleta."""
    return [
        {
            "key": group_key,
            "label": group_label,
            "variables": [
                {"key": key, "label": label, "example": example}
                for key, label, example in variables
            ],
        }
        for group_key, group_label, variables in VARIABLE_GROUPS
    ]


def sample_context():
    """Contexto de exemplo (dados simulados) para pré-visualização sem objeto."""
    return dict(SAMPLE_VALUES)


# --- resolução do contexto real ----------------------------------------------


def _order_total(order):
    gross = money(
        sum(
            (
                line_total(i)
                for items in (
                    order.service_items.all(),
                    order.package_items.all(),
                    order.part_items.all(),
                )
                for i in items
            ),
            Decimal("0"),
        )
    )
    discount = Decimal("0")
    if order.discount_type == "percent":
        discount = gross * (order.discount_value or Decimal("0")) / Decimal("100")
    elif order.discount_type == "fixed":
        discount = order.discount_value or Decimal("0")
    return money(max(gross - discount, Decimal("0")))


def _join_items(items, kinds=None):
    labels = []
    for item in items:
        if kinds is not None and getattr(item, "kind", None) not in kinds:
            continue
        labels.append(getattr(item, "description", "") or "")
    return "; ".join(label for label in labels if label)


def _workshop_context(workshop):
    logo_url = ""
    if getattr(workshop, "logo", None):
        try:
            logo_url = workshop.logo.url
        except ValueError:
            logo_url = ""
    return {
        "oficina.nome": workshop.trade_name or workshop.legal_name or "",
        "oficina.cnpj": format_cnpj(only_digits(workshop.cnpj)) if workshop.cnpj else "",
        "oficina.telefone": format_phone(workshop.phone),
        "oficina.whatsapp": format_phone(workshop.whatsapp),
        "oficina.email": workshop.email or "",
        "oficina.endereco": _address(workshop),
        "oficina.site": workshop.website or "",
        "oficina.logo": logo_url,
        "oficina.horario_funcionamento": getattr(workshop, "business_hours", "") or "",
    }


def _customer_context(customer):
    if customer is None:
        return {}
    type_label = ""
    try:
        type_label = customer.get_customer_type_display()
    except Exception:  # pragma: no cover - defensivo
        type_label = ""
    return {
        "cliente.nome": customer.name or "",
        "cliente.primeiro_nome": (customer.name or "").split(" ")[0],
        "cliente.email": customer.email or "",
        "cliente.telefone": format_phone(customer.phone),
        "cliente.documento": format_document(customer.document),
        "cliente.tipo": type_label,
    }


def _vehicle_context(vehicle):
    if vehicle is None:
        return {}
    year = vehicle.model_year or vehicle.manufacture_year
    km = vehicle.mileage
    return {
        "veiculo.placa": vehicle.license_plate or "",
        "veiculo.marca": vehicle.brand or "",
        "veiculo.modelo": vehicle.model or "",
        "veiculo.versao": vehicle.version or "",
        "veiculo.ano": str(year) if year else "",
        "veiculo.cor": vehicle.color or "",
        "veiculo.quilometragem": f"{km:,} km".replace(",", ".") if km else "",
        "veiculo.chassi": vehicle.chassis or "",
    }


def _order_context(order):
    if order is None:
        return {}
    portal = ""
    return {
        "ordem_servico.numero": f"{order.number:04d}",
        "ordem_servico.status": order.get_status_display(),
        "ordem_servico.data_abertura": format_date(order.opened_at),
        "ordem_servico.data_prevista": format_date(order.expected_delivery),
        "ordem_servico.relato_cliente": order.customer_report or "",
        "ordem_servico.diagnostico": order.diagnosis or "",
        "ordem_servico.observacoes": order.internal_notes or "",
        "ordem_servico.servicos": _join_items(
            list(order.service_items.all()) + list(order.package_items.all())
        ),
        "ordem_servico.pecas": _join_items(order.part_items.all()),
        "ordem_servico.valor_total": format_brl(_order_total(order)),
        "ordem_servico.link_portal": portal,
    }


def _quote_context(quote):
    if quote is None:
        return {}
    totals = compute_totals(quote)
    items = list(quote.items.all())
    approved = "; ".join(i.description for i in items if i.status == "approved")
    rejected = "; ".join(i.description for i in items if i.status == "rejected")
    link = f"{settings.FRONTEND_URL}/orcamento/{quote.public_token}"
    return {
        "orcamento.numero": f"{quote.number:04d}",
        "orcamento.status": quote.get_status_display(),
        "orcamento.valor_total": format_brl(totals["total_quoted"]),
        "orcamento.valor_aprovado": format_brl(totals["total_approved"]),
        "orcamento.valor_pendente": format_brl(totals["total_pending"]),
        "orcamento.itens_aprovados": approved,
        "orcamento.itens_recusados": rejected,
        "orcamento.prazo_validade": format_date(quote.valid_until),
        "orcamento.link_aprovacao": link,
        "orcamento.link_pdf": link,
    }


def _financial_context(order, payment=None):
    if order is None:
        return {}
    payments = list(order.payments.all())
    paid = money(sum((p.amount for p in payments), Decimal("0")))
    total = _order_total(order)
    open_amount = money(max(total - paid, Decimal("0")))
    method = ""
    ref_payment = payment or (payments[-1] if payments else None)
    if ref_payment is not None:
        try:
            method = ref_payment.get_method_display()
        except Exception:  # pragma: no cover - defensivo
            method = ""
    return {
        "financeiro.valor_aberto": format_brl(open_amount),
        "financeiro.valor_pago": format_brl(paid),
        "financeiro.forma_pagamento": method,
        "financeiro.data_vencimento": format_date(order.expected_delivery),
        "financeiro.link_pagamento": "",
    }


def build_context(*, work_order=None, quote=None, payment=None):
    """Monta o dicionário plano ``{"grupo.chave": valor}`` para renderização.

    Aceita uma OS e/ou um orçamento e/ou um pagamento. A oficina (singleton) é
    sempre incluída. Toda chave do catálogo recebe pelo menos string vazia, de
    modo que a renderização nunca falhe por ausência de dado.
    """
    from apps.workshop.models import WorkshopProfile

    if quote is not None and work_order is None:
        work_order = quote.work_order

    order = work_order
    customer = None
    vehicle = None
    if order is not None:
        customer = order.customer
        vehicle = order.vehicle
    elif quote is not None:
        customer = quote.work_order.customer
        vehicle = quote.work_order.vehicle

    context = {key: "" for key in ALL_VARIABLE_KEYS}
    context.update(_workshop_context(WorkshopProfile.get_solo()))
    context.update(_customer_context(customer))
    context.update(_vehicle_context(vehicle))
    context.update(_order_context(order))
    context.update(_quote_context(quote))
    context.update(_financial_context(order, payment))
    return context
