"""Templates padrão profissionais por evento e canal.

Estes são os conteúdos "de fábrica": funcionam imediatamente após a instalação,
mesmo sem qualquer personalização, e são a base para o botão *Restaurar padrão*.
O conteúdo real vive no banco (:class:`NotificationTemplate`); aqui está a fonte
canônica usada para semear e restaurar.

O HTML de e-mail usa layout em tabela com CSS inline (compatível com clientes de
e-mail) e é responsivo. Todos os canais compartilham a mesma "receita" por evento
(assunto, texto de abertura, corpo, informações principais e botão de ação), da
qual derivamos as variantes de cada canal.
"""

from .events import EVENTS

# Canais suportados (mesma lista de NotificationTemplate.Channel).
CHANNELS = ["email", "whatsapp", "sms", "internal"]

# Cores do layout (neutras/profissionais, seguras em clientes de e-mail).
_PRIMARY = "#1f6feb"
_INK = "#1f2937"
_MUTED = "#6b7280"
_BORDER = "#e5e7eb"
_BG = "#f3f4f6"


# --- receita por evento -------------------------------------------------------
# Cada entrada:
#   name, subject, lead, body (lista de parágrafos), info (lista (label, valor)),
#   cta (None ou (label, "{{var}}"))
EVENT_CONTENT = {
    "order_opened": {
        "name": "Abertura de OS",
        "subject": "OS {{ordem_servico.numero}} aberta — {{oficina.nome}}",
        "lead": "Recebemos seu veículo e abrimos a Ordem de Serviço. Vamos acompanhar cada etapa e mantê-lo(a) informado(a).",
        "body": [
            "A partir de agora você receberá atualizações sobre o andamento do serviço. Qualquer dúvida, estamos à disposição.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Abertura", "{{ordem_servico.data_abertura}}"),
            ("Previsão de entrega", "{{ordem_servico.data_prevista}}"),
        ],
        "cta": None,
    },
    "appointment_confirmed": {
        "name": "Confirmação de agendamento",
        "subject": "Agendamento confirmado — {{oficina.nome}}",
        "lead": "Seu agendamento está confirmado. Esperamos você na data combinada.",
        "body": [
            "Se precisar remarcar ou tiver qualquer imprevisto, entre em contato com antecedência pelo WhatsApp {{oficina.whatsapp}}.",
        ],
        "info": [
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Data prevista", "{{ordem_servico.data_prevista}}"),
        ],
        "cta": None,
    },
    "no_show": {
        "name": "Cliente não compareceu",
        "subject": "Sentimos sua falta — {{oficina.nome}}",
        "lead": "Notamos que não foi possível comparecer ao agendamento. Tudo bem, imprevistos acontecem!",
        "body": [
            "Podemos reagendar quando for melhor para você. É só responder esta mensagem ou falar com a gente pelo WhatsApp {{oficina.whatsapp}}.",
        ],
        "info": [
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "vehicle_checkin": {
        "name": "Check-in do veículo",
        "subject": "Recebemos seu veículo — OS {{ordem_servico.numero}}",
        "lead": "Confirmamos a entrada do seu veículo na oficina. Ele está em boas mãos.",
        "body": [
            "Assim que concluirmos a avaliação inicial, avisaremos sobre os próximos passos.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Quilometragem", "{{veiculo.quilometragem}}"),
        ],
        "cta": None,
    },
    "diagnosis_done": {
        "name": "Diagnóstico concluído",
        "subject": "Diagnóstico concluído — OS {{ordem_servico.numero}}",
        "lead": "Concluímos o diagnóstico do seu veículo.",
        "body": [
            "Diagnóstico: {{ordem_servico.diagnostico}}",
            "Em breve enviaremos o orçamento com os serviços recomendados para sua aprovação.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "quote_sent": {
        "name": "Orçamento enviado",
        "subject": "Orçamento {{orcamento.numero}} para sua avaliação — {{oficina.nome}}",
        "lead": "Preparamos o orçamento dos serviços do seu veículo. Ele está pronto para sua avaliação.",
        "body": [
            "Acesse o link abaixo para visualizar, aprovar ou recusar o orçamento. O link é pessoal e não exige login.",
        ],
        "info": [
            ("Orçamento", "{{orcamento.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Valor total", "{{orcamento.valor_total}}"),
            ("Válido até", "{{orcamento.prazo_validade}}"),
        ],
        "cta": ("Visualizar orçamento", "{{orcamento.link_aprovacao}}"),
    },
    "quote_approved": {
        "name": "Orçamento aprovado",
        "subject": "Recebemos sua aprovação — Orçamento {{orcamento.numero}}",
        "lead": "Obrigado! Registramos a aprovação do seu orçamento e já vamos programar a execução.",
        "body": [
            "Assim que iniciarmos os serviços, você será avisado(a).",
        ],
        "info": [
            ("Orçamento", "{{orcamento.numero}}"),
            ("Valor aprovado", "{{orcamento.valor_aprovado}}"),
        ],
        "cta": None,
    },
    "quote_partially_approved": {
        "name": "Orçamento aprovado parcialmente",
        "subject": "Aprovação parcial registrada — Orçamento {{orcamento.numero}}",
        "lead": "Registramos a aprovação parcial do seu orçamento. Vamos executar os itens aprovados.",
        "body": [
            "Itens aprovados: {{orcamento.itens_aprovados}}",
            "Itens não aprovados: {{orcamento.itens_recusados}}",
            "Se quiser rever algum item depois, é só falar com a gente.",
        ],
        "info": [
            ("Orçamento", "{{orcamento.numero}}"),
            ("Valor aprovado", "{{orcamento.valor_aprovado}}"),
        ],
        "cta": None,
    },
    "quote_rejected": {
        "name": "Orçamento recusado",
        "subject": "Orçamento {{orcamento.numero}} — recusa registrada",
        "lead": "Registramos que o orçamento não foi aprovado neste momento. Sem problemas!",
        "body": [
            "Se mudar de ideia ou quiser um novo orçamento, estamos à disposição pelo WhatsApp {{oficina.whatsapp}}.",
        ],
        "info": [
            ("Orçamento", "{{orcamento.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "awaiting_parts": {
        "name": "Aguardando peças",
        "subject": "OS {{ordem_servico.numero}} — aguardando peças",
        "lead": "Seu serviço está aguardando a chegada de peças para prosseguir.",
        "body": [
            "Assim que as peças chegarem, retomaremos a execução e avisaremos você.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "in_progress": {
        "name": "Em execução",
        "subject": "OS {{ordem_servico.numero}} — em execução",
        "lead": "Boas notícias: os serviços do seu veículo estão em execução.",
        "body": [
            "Avisaremos assim que o veículo estiver pronto para retirada.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Previsão de entrega", "{{ordem_servico.data_prevista}}"),
        ],
        "cta": None,
    },
    "in_testing": {
        "name": "Em teste",
        "subject": "OS {{ordem_servico.numero}} — em teste",
        "lead": "Concluímos os serviços e seu veículo está em fase de testes de qualidade.",
        "body": [
            "É a etapa final antes da liberação. Em breve avisaremos que está pronto.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "ready_for_pickup": {
        "name": "Pronta para retirada",
        "subject": "Seu veículo está pronto! — OS {{ordem_servico.numero}}",
        "lead": "Seu veículo está pronto para retirada. Pode vir buscá-lo!",
        "body": [
            "Nosso horário de funcionamento é {{oficina.horario_funcionamento}}. Qualquer dúvida, fale com a gente pelo WhatsApp {{oficina.whatsapp}}.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Valor total", "{{ordem_servico.valor_total}}"),
            ("Endereço", "{{oficina.endereco}}"),
        ],
        "cta": None,
    },
    "os_finished": {
        "name": "OS finalizada",
        "subject": "OS {{ordem_servico.numero}} finalizada — {{oficina.nome}}",
        "lead": "Sua Ordem de Serviço foi finalizada. Obrigado pela confiança!",
        "body": [
            "Esperamos que esteja tudo certo com seu veículo. Contamos com você numa próxima!",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
            ("Valor total", "{{ordem_servico.valor_total}}"),
        ],
        "cta": None,
    },
    "financial_pending": {
        "name": "Pendência financeira",
        "subject": "OS {{ordem_servico.numero}} — valor em aberto",
        "lead": "Identificamos um valor em aberto referente à sua Ordem de Serviço.",
        "body": [
            "Para regularizar ou tirar dúvidas sobre o pagamento, fale com a gente pelo WhatsApp {{oficina.whatsapp}}.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Valor em aberto", "{{financeiro.valor_aberto}}"),
            ("Valor pago", "{{financeiro.valor_pago}}"),
        ],
        "cta": None,
    },
    "payment_received": {
        "name": "Pagamento recebido",
        "subject": "Pagamento recebido — OS {{ordem_servico.numero}}",
        "lead": "Confirmamos o recebimento do seu pagamento. Obrigado!",
        "body": [
            "Este é o comprovante do pagamento registrado para a sua Ordem de Serviço.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Valor pago", "{{financeiro.valor_pago}}"),
            ("Forma de pagamento", "{{financeiro.forma_pagamento}}"),
            ("Valor em aberto", "{{financeiro.valor_aberto}}"),
        ],
        "cta": None,
    },
    "pickup_reminder": {
        "name": "Lembrete de retirada",
        "subject": "Lembrete: seu veículo aguarda retirada — OS {{ordem_servico.numero}}",
        "lead": "Passando para lembrar que seu veículo já está pronto e aguarda retirada.",
        "body": [
            "Nosso horário de funcionamento é {{oficina.horario_funcionamento}}. Estamos no endereço {{oficina.endereco}}.",
        ],
        "info": [
            ("Ordem de Serviço", "{{ordem_servico.numero}}"),
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "post_service_followup": {
        "name": "Follow-up pós-serviço",
        "subject": "Como está seu veículo? — {{oficina.nome}}",
        "lead": "Faz alguns dias que você retirou seu veículo e gostaríamos de saber como está tudo.",
        "body": [
            "Sua opinião é muito importante para nós. Qualquer observação, é só responder esta mensagem.",
            "Obrigado por confiar na {{oficina.nome}}!",
        ],
        "info": [
            ("Veículo", "{{veiculo.marca}} {{veiculo.modelo}} — {{veiculo.placa}}"),
        ],
        "cta": None,
    },
    "manual_general": {
        "name": "Mensagem geral",
        "subject": "Mensagem da {{oficina.nome}}",
        "lead": "Temos uma mensagem para você.",
        "body": [
            "Escreva aqui o conteúdo da sua mensagem. Você pode usar as variáveis disponíveis para personalizar automaticamente.",
        ],
        "info": [],
        "cta": None,
    },
}


# --- construtores de HTML/texto ----------------------------------------------


def _info_table_html(info):
    if not info:
        return ""
    rows = "".join(
        f"""
        <tr>
          <td style="padding:6px 0;color:{_MUTED};font-size:13px;white-space:nowrap;">{label}</td>
          <td style="padding:6px 0 6px 16px;color:{_INK};font-size:14px;font-weight:600;">{value}</td>
        </tr>"""
        for label, value in info
    )
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="margin:20px 0;border-top:1px solid {_BORDER};border-bottom:1px solid {_BORDER};">
        {rows}
      </table>"""


def _cta_html(cta):
    if not cta:
        return ""
    label, href = cta
    return f"""
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td style="border-radius:6px;background:{_PRIMARY};">
          <a href="{href}" style="display:inline-block;padding:12px 28px;color:#ffffff;
             font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">{label}</a>
        </td></tr>
      </table>"""


def build_email_html(recipe):
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;color:{_INK};font-size:15px;line-height:1.6;">{p}</p>'
        for p in recipe["body"]
    )
    return f"""<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid {_BORDER};">
        <tr><td style="background:{_PRIMARY};padding:22px 32px;">
          <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:.2px;">{{{{oficina.nome}}}}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:{_INK};font-size:16px;font-weight:600;">Olá, {{{{cliente.primeiro_nome}}}}!</p>
          <p style="margin:0 0 14px;color:{_INK};font-size:15px;line-height:1.6;">{recipe["lead"]}</p>
          {_info_table_html(recipe["info"])}
          {paragraphs}
          {_cta_html(recipe["cta"])}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid {_BORDER};">
          <p style="margin:0 0 4px;color:{_INK};font-size:13px;font-weight:600;">{{{{oficina.nome}}}}</p>
          <p style="margin:0;color:{_MUTED};font-size:12px;line-height:1.6;">
            {{{{oficina.endereco}}}}<br>
            Telefone: {{{{oficina.telefone}}}} · WhatsApp: {{{{oficina.whatsapp}}}}<br>
            {{{{oficina.email}}}} · {{{{oficina.site}}}}
          </p>
          <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;line-height:1.5;">
            Você recebeu este e-mail porque possui um atendimento na {{{{oficina.nome}}}}.
            Em caso de dúvidas, entre em contato com a oficina.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def build_text(recipe):
    lines = ["Olá, {{cliente.primeiro_nome}}!", "", recipe["lead"], ""]
    for label, value in recipe["info"]:
        lines.append(f"{label}: {value}")
    if recipe["info"]:
        lines.append("")
    lines.extend(recipe["body"])
    if recipe["cta"]:
        label, href = recipe["cta"]
        lines.extend(["", f"{label}: {href}"])
    lines.extend(
        [
            "",
            "—",
            "{{oficina.nome}}",
            "{{oficina.endereco}}",
            "Telefone: {{oficina.telefone}} · WhatsApp: {{oficina.whatsapp}}",
        ]
    )
    return "\n".join(lines).strip()


def build_whatsapp(recipe):
    lines = ["Olá, {{cliente.primeiro_nome}}! 👋", "", recipe["lead"]]
    if recipe["info"]:
        lines.append("")
        for label, value in recipe["info"]:
            lines.append(f"*{label}:* {value}")
    for paragraph in recipe["body"]:
        lines.extend(["", paragraph])
    if recipe["cta"]:
        label, href = recipe["cta"]
        lines.extend(["", f"{label}: {href}"])
    lines.extend(["", "_{{oficina.nome}}_"])
    return "\n".join(lines).strip()


def build_sms(recipe):
    return (
        f"{{{{oficina.nome}}}}: {recipe['lead']} " "Dúvidas: {{oficina.telefone}}"
    ).strip()


def default_template(event_key, channel):
    """Devolve os campos padrão (name/subject/html/text) de um evento/canal."""
    recipe = EVENT_CONTENT[event_key]
    from .events import EVENT_DESCRIPTION

    description = EVENT_DESCRIPTION[event_key]
    if channel == "email":
        return {
            "name": recipe["name"],
            "description": description,
            "subject": recipe["subject"],
            "html_content": build_email_html(recipe),
            "text_content": build_text(recipe),
        }
    if channel == "whatsapp":
        text = build_whatsapp(recipe)
        return {
            "name": recipe["name"],
            "description": description,
            "subject": "",
            "html_content": "",
            "text_content": text,
        }
    if channel == "sms":
        text = build_sms(recipe)
        return {
            "name": recipe["name"],
            "description": description,
            "subject": "",
            "html_content": "",
            "text_content": text,
        }
    # internal
    text = build_text(recipe)
    return {
        "name": recipe["name"],
        "description": description,
        "subject": recipe["subject"],
        "html_content": "",
        "text_content": text,
    }


# Canais semeados por padrão para cada evento (disponíveis na interface desde a
# instalação). E-mail e interno para todos; WhatsApp para todos (envio por link).
# SMS fica disponível para edição, mas sem dispatch automático (sem provedor).
SEEDED_CHANNELS = ["email", "whatsapp", "internal"]


def iter_default_templates():
    """Gera (event_key, channel, fields) para todos os templates semeados."""
    for event_key, _label, _desc, _ctx in EVENTS:
        for channel in SEEDED_CHANNELS:
            yield event_key, channel, default_template(event_key, channel)
