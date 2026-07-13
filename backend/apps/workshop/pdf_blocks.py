"""Catálogo de blocos do construtor de PDF da OS.

O PDF da Ordem de Serviço é montado a partir de uma **lista ordenada de blocos**
(cabeçalho, cliente, veículo, itens, termos, texto livre, espaçador...). Cada
bloco tem um ``type`` e um dicionário de ``options``. Este módulo é a única fonte
da verdade: descreve os tipos disponíveis e suas opções (usado tanto para validar
o que é salvo quanto para alimentar o editor no frontend), guarda o layout padrão
(que reproduz o PDF atual) e normaliza/saneia o que vem da API.
"""

# Catálogo: para cada tipo de bloco, seu rótulo e a especificação das opções.
# `kind` de cada opção: bool | text | textarea | number | select | multi.
BLOCK_CATALOG = [
    {
        "type": "header",
        "label": "Cabeçalho",
        "description": "Logotipo, nome e dados de contato da oficina.",
        "options": [],
    },
    {
        "type": "os_bar",
        "label": "Barra da OS",
        "description": "Número da OS, texto central (via) e data de emissão.",
        "options": [
            {
                "key": "label",
                "kind": "text",
                "label": "Texto central",
                "default": "VIA DO CLIENTE",
            },
            {
                "key": "show_number",
                "kind": "bool",
                "label": "Mostrar número da OS",
                "default": True,
            },
            {
                "key": "show_emission",
                "kind": "bool",
                "label": "Mostrar emissão",
                "default": True,
            },
        ],
    },
    {
        "type": "customer",
        "label": "Cliente",
        "description": "Ficha do cliente (escolha quais campos aparecem).",
        "options": [
            {
                "key": "fields",
                "kind": "multi",
                "label": "Campos",
                "default": ["name", "phone", "email", "document"],
                "choices": [
                    ["name", "Nome"],
                    ["phone", "Telefone"],
                    ["email", "E-mail"],
                    ["document", "CPF/CNPJ"],
                ],
            },
        ],
    },
    {
        "type": "vehicle",
        "label": "Veículo",
        "description": "Ficha do veículo (só os campos preenchidos aparecem).",
        "options": [],
    },
    {
        "type": "dates",
        "label": "Datas / técnico",
        "description": "Abertura, previsão de entrega e técnico responsável.",
        "options": [
            {
                "key": "show_opened",
                "kind": "bool",
                "label": "Data de abertura",
                "default": True,
            },
            {
                "key": "show_expected",
                "kind": "bool",
                "label": "Previsão de entrega",
                "default": True,
            },
            {
                "key": "show_technician",
                "kind": "bool",
                "label": "Técnico responsável",
                "default": True,
            },
        ],
    },
    {
        "type": "diagnosis",
        "label": "Diagnóstico",
        "description": "Relato do cliente e diagnóstico técnico.",
        "options": [
            {
                "key": "show_report",
                "kind": "bool",
                "label": "Relato do cliente",
                "default": True,
            },
            {
                "key": "show_diagnosis",
                "kind": "bool",
                "label": "Diagnóstico técnico",
                "default": True,
            },
        ],
    },
    {
        "type": "items",
        "label": "Serviços e peças",
        "description": "Tabela de itens, totais e (opcional) pago/saldo.",
        "options": [
            {
                "key": "show_totals",
                "kind": "bool",
                "label": "Mostrar totais",
                "default": True,
            },
            {
                "key": "show_payment",
                "kind": "bool",
                "label": "Mostrar pago / saldo",
                "default": False,
            },
        ],
    },
    {
        "type": "terms",
        "label": "Termos",
        "description": "Autorização, garantia, condições gerais e ciência.",
        "options": [
            {
                "key": "include",
                "kind": "multi",
                "label": "Termos incluídos",
                "default": ["authorization", "warranty", "general", "acknowledgment"],
                "choices": [
                    ["authorization", "Autorização de serviço"],
                    ["warranty", "Garantia"],
                    ["general", "Condições gerais"],
                    ["acknowledgment", "Ciência do cliente"],
                ],
            },
        ],
    },
    {
        "type": "signature",
        "label": "Assinatura",
        "description": "Linha de assinatura do cliente.",
        "options": [
            {
                "key": "label",
                "kind": "text",
                "label": "Texto",
                "default": "Assinatura do cliente na retirada do veículo:",
            },
        ],
    },
    {
        "type": "footer",
        "label": "Rodapé",
        "description": "Texto de rodapé configurado nas Configurações da OS.",
        "options": [],
    },
    {
        "type": "text",
        "label": "Texto livre",
        "description": "Um parágrafo com texto fixo à sua escolha.",
        "options": [
            {"key": "content", "kind": "textarea", "label": "Conteúdo", "default": ""},
            {
                "key": "align",
                "kind": "select",
                "label": "Alinhamento",
                "default": "left",
                "choices": [
                    ["left", "Esquerda"],
                    ["center", "Centro"],
                    ["right", "Direita"],
                ],
            },
            {
                "key": "size",
                "kind": "number",
                "label": "Tamanho (pt)",
                "default": 9,
                "min": 6,
                "max": 24,
            },
            {"key": "bold", "kind": "bool", "label": "Negrito", "default": False},
            {"key": "muted", "kind": "bool", "label": "Cor suave", "default": False},
        ],
    },
    {
        "type": "band",
        "label": "Faixa de seção",
        "description": "Uma faixa/título para separar partes do documento.",
        "options": [
            {"key": "label", "kind": "text", "label": "Título", "default": "Seção"},
        ],
    },
    {
        "type": "spacer",
        "label": "Espaçador",
        "description": "Um espaço vertical em branco.",
        "options": [
            {
                "key": "height",
                "kind": "number",
                "label": "Altura (px)",
                "default": 12,
                "min": 2,
                "max": 120,
            },
        ],
    },
]

# Índices auxiliares.
BLOCK_TYPES = {b["type"]: b for b in BLOCK_CATALOG}


# Layout padrão -- reproduz exatamente o PDF atual da OS. É o valor inicial do
# registro e o alvo do botão "Restaurar padrão".
def default_pdf_blocks():
    blocks = []
    for entry in BLOCK_CATALOG:
        if entry["type"] in ("text", "band", "spacer"):
            continue  # blocos "extras" não entram no layout padrão
        options = {opt["key"]: opt["default"] for opt in entry["options"]}
        blocks.append({"type": entry["type"], "options": options})
    return blocks


DEFAULT_ACCENT_COLOR = "#e5e7eb"
DEFAULT_BASE_FONT_SIZE = 8.5

_HEX = "0123456789abcdefABCDEF"


def normalize_accent_color(value):
    """Aceita só cores hex (#rgb / #rrggbb). Cai no padrão se inválida."""
    text = str(value or "").strip()
    if (
        text.startswith("#")
        and len(text) in (4, 7)
        and all(ch in _HEX for ch in text[1:])
    ):
        return text
    return DEFAULT_ACCENT_COLOR


def normalize_base_font_size(value):
    try:
        size = float(value)
    except (TypeError, ValueError):
        return DEFAULT_BASE_FONT_SIZE
    return max(6.0, min(14.0, round(size, 1)))


def _clamp_int(value, lo, hi, default):
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, number))


def _normalize_options(block_type, raw):
    """Mantém só as opções conhecidas do tipo, coagindo cada uma ao seu `kind`
    e aplicando o default quando ausente/ inválida."""
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for opt in BLOCK_TYPES[block_type]["options"]:
        key, kind, default = opt["key"], opt["kind"], opt["default"]
        value = raw.get(key, default)
        if kind == "bool":
            out[key] = bool(value)
        elif kind == "text":
            out[key] = str(value if value is not None else default)[:200]
        elif kind == "textarea":
            out[key] = str(value if value is not None else default)[:5000]
        elif kind == "number":
            out[key] = _clamp_int(
                value, opt.get("min", 0), opt.get("max", 999), default
            )
        elif kind == "select":
            allowed = [c[0] for c in opt["choices"]]
            out[key] = value if value in allowed else default
        elif kind == "multi":
            allowed = [c[0] for c in opt["choices"]]
            if isinstance(value, list):
                out[key] = [v for v in allowed if v in value]  # ordem canônica
            else:
                out[key] = list(default)
    return out


def normalize_blocks(raw_blocks):
    """Saneia a lista de blocos vinda da API: descarta tipos desconhecidos,
    normaliza as opções e preserva um `id` (string) quando enviado -- útil como
    chave estável no editor. Lista vazia é permitida (documento em branco)."""
    if not isinstance(raw_blocks, list):
        return default_pdf_blocks()
    blocks = []
    for item in raw_blocks:
        if not isinstance(item, dict):
            continue
        block_type = item.get("type")
        if block_type not in BLOCK_TYPES:
            continue
        block = {
            "type": block_type,
            "options": _normalize_options(block_type, item.get("options")),
        }
        if isinstance(item.get("id"), str) and item["id"]:
            block["id"] = item["id"][:40]
        blocks.append(block)
    return blocks
