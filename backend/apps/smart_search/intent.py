"""Interpretação de intenção da Busca Inteligente (camada heurística/segura).

Transforma uma pergunta em linguagem natural em uma *intenção* estruturada:
entidades-alvo, período (datas), status e "conceitos" de busca (termos com
sinônimos automotivos e variações com/sem acento). Esta camada NUNCA acessa o
banco nem monta SQL -- só produz filtros que o executor aplica via ORM seguro.

A IA (opcional) refina/expande esta intenção, mas o resultado é sempre validado
contra allowlists aqui, de forma que a IA não consiga injetar campos/entidades
fora do previsto.
"""

import re
import unicodedata
from calendar import monthrange
from datetime import date, timedelta

# Entidades pesquisáveis (allowlist). Usadas também para validar saída da IA.
ENTITIES = ("work_order", "customer", "vehicle", "lead", "financial")

# Status de OS (allowlist). Espelha WorkOrder.Status.
WORK_ORDER_STATUSES = (
    "open",
    "diagnosing",
    "awaiting_approval",
    "approved",
    "in_progress",
    "awaiting_parts",
    "testing",
    "ready",
    "finished",
    "canceled",
    "rejected",
)

MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

# Grupos de sinônimos automotivos (PT-BR / PT-PT). Se qualquer membro aparecer na
# pergunta, todos os membros entram como variantes de busca.
SYNONYM_GROUPS = [
    ["freio", "travao", "freios"],
    ["luz de freio", "luz de stop", "luz de travao", "lampada de stop", "luz traseira"],
    ["embreagem", "embraiagem"],
    ["capo", "capot"],
    ["porta-malas", "porta malas", "bagageira", "mala"],
    ["pneu", "pneus", "roda", "rodas"],
    ["barulho", "ruido", "barulhos"],
    ["marcha", "velocidade", "cambio"],
    ["para-choque", "para choque", "parachoque"],
    ["suspensao", "amortecedor", "bieleta"],
    ["ar-condicionado", "ar condicionado", "climatizacao", "ar"],
    ["oleo", "lubrificante"],
    ["revisao", "revisao completa", "revisao geral"],
    ["bateria", "eletrica", "eletrico", "falha eletrica"],
    ["pastilha", "pastilhas", "disco", "discos"],
    ["farol", "farois", "lanterna"],
    ["escapamento", "escape", "silencioso"],
    ["direcao", "volante"],
    ["radiador", "arrefecimento", "superaquecimento"],
]

# Frases de status -> valor. Ordem importa (mais específico primeiro).
STATUS_PHRASES = [
    ("aguardando aprovacao", "awaiting_approval"),
    ("aguarda aprovacao", "awaiting_approval"),
    ("aguardando pecas", "awaiting_parts"),
    ("aguardando peca", "awaiting_parts"),
    ("pronta para retirada", "ready"),
    ("pronto para retirada", "ready"),
    ("para retirada", "ready"),
    ("em execucao", "in_progress"),
    ("em andamento", "in_progress"),
    ("em diagnostico", "diagnosing"),
    ("em teste", "testing"),
    ("finalizada", "finished"),
    ("finalizadas", "finished"),
    ("concluida", "finished"),
    ("cancelada", "canceled"),
    ("canceladas", "canceled"),
    ("recusada", "rejected"),
    ("recusado", "rejected"),
    ("rejeitada", "rejected"),
    ("aprovada", "approved"),
    ("aprovado", "approved"),
    ("abertas", "open"),
    ("aberta", "open"),
]

# Palavras que indicam a entidade-alvo principal.
ENTITY_KEYWORDS = {
    "work_order": [
        "os",
        "ordem",
        "ordens",
        "reparo",
        "conserto",
        "orcamento",
        "orcamentos",
    ],
    "customer": ["cliente", "clientes"],
    "vehicle": ["veiculo", "veiculos", "carro", "carros", "placa", "matricula", "moto"],
    "lead": ["lead", "leads", "pedido do site", "pedidos do site"],
    "financial": [
        "pagamento",
        "pagamentos",
        "financeiro",
        "atrasado",
        "atrasados",
        "vencido",
        "vencidos",
        "em aberto",
        "cobranca",
        "inadimplente",
    ],
}

# Palavras de comando/ligação/período que não são termos de conteúdo.
_STOPWORDS = {
    "a",
    "o",
    "os",
    "as",
    "um",
    "uma",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "ou",
    "que",
    "com",
    "sem",
    "no",
    "na",
    "nos",
    "nas",
    "em",
    "para",
    "por",
    "quero",
    "mostre",
    "mostrar",
    "procure",
    "procurar",
    "buscar",
    "busca",
    "qual",
    "quais",
    "quem",
    "onde",
    "quando",
    "me",
    "meu",
    "minha",
    "esta",
    "este",
    "isso",
    "ao",
    "estava",
    "esteve",
    "teve",
    "tem",
    "ter",
    "foi",
    "ser",
    "fez",
    "fizeram",
    "ainda",
    "mais",
    "menos",
    "muito",
    "todos",
    "todas",
    "algum",
    "alguns",
    "ha",
    "dias",
    "dia",
    "meses",
    "mes",
    "anos",
    "ano",
    "semana",
    "semanas",
    "passado",
    "passada",
    "ultimos",
    "ultimas",
    "ultimo",
    "ultima",
    "entre",
    "voltou",
    "voltaram",
    "reclamou",
    "informou",
    "pediu",
    "recusou",
    "aceitou",
    "seu",
    "sua",
    "acesa",
    "aceso",
    "hoje",
    "ontem",
    # descritores de status (viram filtro de status, não termo de conteúdo)
    "diagnostico",
    "aprovacao",
    "execucao",
    "andamento",
    "retirada",
    "finalizada",
    "finalizadas",
    "concluida",
    "cancelada",
    "canceladas",
    "aberta",
    "abertas",
    "teste",
    "aprovada",
    "aprovado",
    "recusada",
    "recusado",
    "rejeitada",
    "pecas",
    "peca",
    "pronta",
    "pronto",
    "aguardando",
    "aguarda",
    "novo",
    "nova",
    "novos",
    "novas",
    # nomes de meses (viram filtro de período)
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
}


def deaccent(text):
    """Remove acentos e normaliza para minúsculas (para comparação tolerante)."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _week_bounds(today):
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def _month_bounds(year, month):
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def detect_period(query, today):
    """Interpreta datas relativas/absolutas. Devolve (start, end, label) ou None."""
    n = deaccent(query)

    m = re.search(r"ultim[oa]s?\s+(\d{1,3})\s+dias?", n)
    if m:
        days = int(m.group(1))
        return today - timedelta(days=days), today, f"Últimos {days} dias"

    m = re.search(r"ultim[oa]s?\s+(\d{1,2})\s+(mes|meses)", n)
    if m:
        months = int(m.group(1))
        return today - timedelta(days=months * 30), today, f"Últimos {months} meses"

    if "semana passada" in n:
        start, end = _week_bounds(today - timedelta(days=7))
        return start, end, "Semana passada"
    if "esta semana" in n or "nesta semana" in n:
        start, end = _week_bounds(today)
        return start, end, "Esta semana"

    if "mes passado" in n:
        first = date(today.year, today.month, 1)
        prev_end = first - timedelta(days=1)
        start, end = _month_bounds(prev_end.year, prev_end.month)
        return start, end, "Mês passado"
    if "este mes" in n or "neste mes" in n:
        start, end = _month_bounds(today.year, today.month)
        return start, end, "Este mês"

    if "ano passado" in n:
        y = today.year - 1
        return date(y, 1, 1), date(y, 12, 31), "Ano passado"
    if "este ano" in n or "neste ano" in n:
        return date(today.year, 1, 1), date(today.year, 12, 31), "Este ano"

    if "hoje" in n:
        return today, today, "Hoje"
    if "ontem" in n:
        y = today - timedelta(days=1)
        return y, y, "Ontem"

    # "entre março e maio"
    m = re.search(r"entre\s+([a-z]+)\s+e\s+([a-z]+)", n)
    if m and m.group(1) in MONTHS and m.group(2) in MONTHS:
        m1, m2 = MONTHS[m.group(1)], MONTHS[m.group(2)]
        start, _ = _month_bounds(today.year, m1)
        _, end = _month_bounds(today.year, m2)
        label = f"{m.group(1).capitalize()} a {m.group(2).capitalize()}"
        return start, end, label

    # "em 2025" / "de 2025"
    m = re.search(r"\b(20\d{2})\b", n)
    if m:
        y = int(m.group(1))
        return date(y, 1, 1), date(y, 12, 31), f"Em {y}"

    # "em janeiro"
    for name, num in MONTHS.items():
        if re.search(rf"\b(em|de)\s+{name}\b", n):
            start, end = _month_bounds(today.year, num)
            return start, end, f"Em {name.capitalize()}"

    return None


def detect_statuses(query):
    n = deaccent(query)
    found = []
    for phrase, status in STATUS_PHRASES:
        if phrase in n and status not in found:
            found.append(status)
    return found


def detect_entities(query):
    n = deaccent(query)
    hits = []
    for entity, words in ENTITY_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(w)}\b", n) for w in words):
            hits.append(entity)
    return hits


def build_concepts(query):
    """Extrai conceitos de busca (com sinônimos e variantes com/sem acento).

    Cada conceito = {label, variants}. Sinônimos contam como um único conceito,
    para o ranking não superestimar relevância.
    """
    lower = (query or "").lower()
    n = deaccent(lower)
    concepts = []
    covered = set()

    for group in SYNONYM_GROUPS:
        # Casa por palavra inteira: evita que membros curtos (ex.: "ar") casem
        # dentro de outras palavras ("reclamar", "solar").
        if any(re.search(rf"\b{re.escape(deaccent(member))}\b", n) for member in group):
            variants = set()
            for member in group:
                variants.add(member)
                variants.add(deaccent(member))
            concepts.append({"label": group[0], "variants": sorted(variants)})
            for member in group:
                for word in deaccent(member).split():
                    covered.add(word)

    for token in re.findall(r"[0-9a-zà-ú]+", lower):
        d = deaccent(token)
        # Ignora tokens curtos, stopwords, já cobertos por sinônimo e números
        # puros (anos/quantidades já viram período, não termo de conteúdo).
        if len(d) < 3 or d.isdigit() or d in _STOPWORDS or d in covered:
            continue
        concepts.append({"label": token, "variants": sorted({token, d})})
        covered.add(d)

    return concepts


def interpret(query, *, today=None, limit=20):
    """Interpretação heurística completa da pergunta -> intenção estruturada."""
    today = today or date.today()
    period = detect_period(query, today)
    statuses = detect_statuses(query)
    entities = detect_entities(query)
    concepts = build_concepts(query)

    date_range = None
    if period:
        start, end, label = period
        date_range = {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "label": label,
        }

    return {
        "entities": entities,
        "statuses": statuses,
        "concepts": concepts,
        "date_range": date_range,
        "sort": "relevance",
        "limit": limit,
        "used_ai": False,
    }
