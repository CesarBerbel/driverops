"""Regras mínimas de transição de status da OS (fluxo operacional do Kanban).

Usadas pela ação ``move`` do WorkOrderViewSet quando uma OS é arrastada entre
colunas no Kanban. A edição completa da OS (formulário) não passa por aqui: lá o
status pode ser ajustado livremente. O objetivo é um fluxo guiado no Kanban, com
o backend como fonte da verdade -- o frontend nunca é a única barreira.

"Finalizada" e "Cancelada" são estados terminais no Kanban: não se sai deles por
arrastar (exigiria permissão especial / edição completa da OS). A arquitetura já
está preparada para regras mais avançadas (por perfil/permissão) sem refatoração.
"""

ALLOWED_TRANSITIONS = {
    "open": ["diagnosing", "awaiting_approval", "canceled"],
    "diagnosing": ["awaiting_approval", "canceled"],
    "awaiting_approval": ["approved", "canceled"],
    "approved": ["in_progress", "canceled"],
    "in_progress": ["awaiting_parts", "testing", "ready"],
    "awaiting_parts": ["in_progress"],
    "testing": ["ready", "in_progress"],
    "ready": ["finished"],
    "finished": [],
    "canceled": [],
}


def can_transition(current, target):
    """True se a OS pode mover de ``current`` para ``target`` via Kanban.

    Mover para o mesmo status é sempre válido (no-op de reordenação na coluna).
    """
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, [])


def allowed_targets(current):
    """Lista de status de destino permitidos a partir de ``current``."""
    return list(ALLOWED_TRANSITIONS.get(current, []))
