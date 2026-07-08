"""Catálogo de eventos de notificação ao cliente.

Fonte única da verdade dos eventos que a oficina comunica ao cliente. Cada
evento tem uma chave interna estável, um rótulo amigável, uma descrição da
finalidade e um "contexto" (``order``/``quote``/``payment``/``manual``) que
determina quais grupos de variáveis se aplicam e como montar a pré-visualização.

Este catálogo é código (não um modelo): os eventos são fixos e versionados junto
com o sistema. Os *templates* (conteúdo editável por evento/canal) vivem no banco
-- ver :mod:`apps.notifications.models`.
"""

# Contextos de dados disponíveis para cada evento (define os grupos de variáveis
# aplicáveis e o objeto usado na pré-visualização com dados reais).
CONTEXT_ORDER = "order"
CONTEXT_QUOTE = "quote"
CONTEXT_PAYMENT = "payment"
CONTEXT_MANUAL = "manual"

# Cada evento: (chave, rótulo, descrição, contexto)
EVENTS = [
    (
        "order_opened",
        "Abertura de ordem de serviço",
        "Enviado ao cliente quando a OS é aberta na oficina.",
        CONTEXT_ORDER,
    ),
    (
        "appointment_confirmed",
        "Confirmação de agendamento",
        "Confirma ao cliente a data/horário agendado para o serviço.",
        CONTEXT_ORDER,
    ),
    (
        "no_show",
        "Cliente não compareceu",
        "Aviso quando o cliente não compareceu ao agendamento.",
        CONTEXT_ORDER,
    ),
    (
        "vehicle_checkin",
        "Check-in do veículo",
        "Confirma o recebimento do veículo na oficina.",
        CONTEXT_ORDER,
    ),
    (
        "diagnosis_done",
        "Diagnóstico concluído",
        "Informa que o diagnóstico do veículo foi concluído.",
        CONTEXT_ORDER,
    ),
    (
        "quote_sent",
        "Orçamento enviado",
        "Envia ao cliente o orçamento para avaliação e aprovação.",
        CONTEXT_QUOTE,
    ),
    (
        "quote_approved",
        "Orçamento aprovado totalmente",
        "Confirma o recebimento da aprovação total do orçamento.",
        CONTEXT_QUOTE,
    ),
    (
        "quote_partially_approved",
        "Orçamento aprovado parcialmente",
        "Confirma a aprovação parcial do orçamento e os itens aprovados.",
        CONTEXT_QUOTE,
    ),
    (
        "quote_rejected",
        "Orçamento recusado",
        "Confirma o registro da recusa do orçamento pelo cliente.",
        CONTEXT_QUOTE,
    ),
    (
        "awaiting_parts",
        "OS aguardando peças",
        "Informa que a OS aguarda a chegada de peças.",
        CONTEXT_ORDER,
    ),
    (
        "in_progress",
        "OS em execução",
        "Informa que os serviços da OS estão em execução.",
        CONTEXT_ORDER,
    ),
    (
        "in_testing",
        "OS em teste",
        "Informa que o veículo está em fase de testes.",
        CONTEXT_ORDER,
    ),
    (
        "ready_for_pickup",
        "OS pronta para retirada",
        "Avisa que o veículo está pronto para ser retirado.",
        CONTEXT_ORDER,
    ),
    (
        "os_finished",
        "OS finalizada",
        "Confirma a finalização da OS e a entrega do veículo.",
        CONTEXT_ORDER,
    ),
    (
        "financial_pending",
        "Cobrança ou pendência financeira",
        "Comunica ao cliente um valor em aberto ou pendência financeira.",
        CONTEXT_ORDER,
    ),
    (
        "payment_received",
        "Pagamento recebido (recibo)",
        "Confirma ao cliente o recebimento de um pagamento da OS.",
        CONTEXT_PAYMENT,
    ),
    (
        "pickup_reminder",
        "Lembrete de retirada do veículo",
        "Lembra o cliente de retirar o veículo já pronto na oficina.",
        CONTEXT_ORDER,
    ),
    (
        "post_service_followup",
        "Follow-up pós-serviço",
        "Acompanhamento de satisfação após a entrega do veículo.",
        CONTEXT_ORDER,
    ),
    (
        "manual_general",
        "Mensagem geral (envio manual)",
        "Modelo base para mensagens gerais enviadas manualmente pela oficina.",
        CONTEXT_MANUAL,
    ),
]

EVENT_KEYS = [key for key, _label, _desc, _ctx in EVENTS]
EVENT_CHOICES = [(key, label) for key, label, _desc, _ctx in EVENTS]
EVENT_CONTEXT = {key: ctx for key, _label, _desc, ctx in EVENTS}
EVENT_LABEL = {key: label for key, label, _desc, _ctx in EVENTS}
EVENT_DESCRIPTION = {key: desc for key, _label, desc, _ctx in EVENTS}


# Status da OS -> evento de notificação correspondente. Usado para migrar os
# disparos automáticos por mudança de status para o motor de templates. Status
# sem evento dedicado caem no template genérico de status (ver services).
STATUS_EVENT_MAP = {
    "diagnosing": "diagnosis_done",
    "in_progress": "in_progress",
    "awaiting_parts": "awaiting_parts",
    "testing": "in_testing",
    "ready": "ready_for_pickup",
    "finished": "os_finished",
}


def event_meta(key):
    """Devolve (label, descrição, contexto) do evento, ou levanta KeyError."""
    return EVENT_LABEL[key], EVENT_DESCRIPTION[key], EVENT_CONTEXT[key]
