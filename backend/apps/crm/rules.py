"""Motor de regras determinístico do CRM inteligente.

Identifica oportunidades objetivas (prazo/status) e cria sugestões idempotentes
(dedup por chave). A IA NÃO é usada aqui -- regras críticas de prazo não podem
depender de IA. O texto sugerido é um template pronto; a IA refina sob demanda.
"""

from datetime import date, timedelta

from django.utils import timezone

from .models import (
    Category,
    Channel,
    CrmSettings,
    CrmSuggestion,
    Priority,
    SuggestionStatus,
    SuggestionType,
)

# --- templates de mensagem (revisáveis pelo usuário) ----------------------

TEMPLATES = {
    SuggestionType.QUOTE_FOLLOWUP: (
        "Olá, {first_name}. Tudo bem? Passando para saber se ficou alguma dúvida "
        "sobre o orçamento do veículo {plate}. Estamos à disposição para explicar "
        "os itens e ajudar no que for necessário."
    ),
    SuggestionType.QUOTE_REJECTED: (
        "Olá, {first_name}. Entendemos que o orçamento do veículo {plate} não "
        "seguiu por ora. Se quiser, podemos revisar os itens prioritários ou tirar "
        "qualquer dúvida, sem compromisso."
    ),
    SuggestionType.QUOTE_EXPIRING: (
        "Olá, {first_name}. Lembrando que o orçamento do veículo {plate} está "
        "próximo do prazo de validade. Se desejar, podemos seguir com os itens ou "
        "revisar as prioridades."
    ),
    SuggestionType.OS_READY: (
        "Olá, {first_name}. Seu veículo {plate} já está pronto para retirada. "
        "Quando puder, entre em contato para combinarmos o melhor horário."
    ),
    SuggestionType.OS_AWAITING_APPROVAL: (
        "Olá, {first_name}. Estamos aguardando sua aprovação para dar andamento aos "
        "serviços do veículo {plate}. Podemos ajudar com alguma dúvida?"
    ),
    SuggestionType.OS_STALLED: (
        "Olá, {first_name}. Passando para atualizar sobre o andamento do serviço do "
        "veículo {plate}. Estamos à disposição para qualquer informação."
    ),
    SuggestionType.POST_SERVICE: (
        "Olá, {first_name}. Obrigado por confiar na nossa oficina. Como foi a sua "
        "experiência com o serviço no veículo {plate}? Sua avaliação nos ajuda muito."
    ),
    SuggestionType.PREVENTIVE: (
        "Olá, {first_name}. Já faz algum tempo desde o último atendimento do seu "
        "veículo {plate}. Se desejar, podemos agendar uma revisão preventiva para "
        "verificar os principais itens de segurança e manutenção."
    ),
    SuggestionType.INACTIVE_CUSTOMER: (
        "Olá, {first_name}. Sentimos sua falta! Que tal um check-up preventivo no "
        "seu veículo {plate} para manter tudo em dia?"
    ),
    SuggestionType.LEAD_FOLLOWUP: (
        "Olá, {first_name}. Recebemos o seu contato pelo site e gostaríamos de "
        "ajudar. Qual o melhor horário para falarmos?"
    ),
    SuggestionType.SEASONAL_CAMPAIGN: (
        "Vai viajar no feriado? Podemos fazer uma revisão preventiva no seu veículo "
        "para verificar óleo, filtros, freios, pneus e itens essenciais antes da "
        "estrada."
    ),
}


def _first_name(customer):
    if not customer:
        return "cliente"
    return (customer.name or "cliente").strip().split(" ")[0]


def _plate(vehicle):
    return vehicle.license_plate if vehicle else "seu veículo"


def render_text(suggestion_type, customer=None, vehicle=None):
    return TEMPLATES.get(suggestion_type, "").format(
        first_name=_first_name(customer), plate=_plate(vehicle)
    )


# --- feriados -------------------------------------------------------------

# Feriados nacionais de data fixa (mês, dia). Datas móveis (Páscoa/Carnaval)
# ficam a cargo dos feriados customizados nas configurações.
FIXED_HOLIDAYS = [
    (1, 1, "Confraternização Universal"),
    (4, 21, "Tiradentes"),
    (5, 1, "Dia do Trabalho"),
    (9, 7, "Independência"),
    (10, 12, "Nossa Senhora Aparecida"),
    (11, 2, "Finados"),
    (11, 15, "Proclamação da República"),
    (12, 25, "Natal"),
]


def upcoming_holiday(conf, today=None):
    """Primeiro feriado dentro de ``holiday_lead_days`` (fixos + customizados)."""
    today = today or timezone.localdate()
    limit = today + timedelta(days=conf.holiday_lead_days)
    candidates = []
    for month, day, name in FIXED_HOLIDAYS:
        for year in (today.year, today.year + 1):
            try:
                d = date(year, month, day)
            except ValueError:
                continue
            candidates.append((d, name))
    for item in conf.custom_holidays or []:
        try:
            d = date.fromisoformat(item.get("date"))
        except (ValueError, TypeError, AttributeError):
            continue
        candidates.append((d, item.get("name", "Feriado")))
    upcoming = sorted(
        (c for c in candidates if today <= c[0] <= limit), key=lambda c: c[0]
    )
    return upcoming[0] if upcoming else None


# --- helpers de domínio ---------------------------------------------------


def _finished_date(order):
    hist = (
        order.status_history.filter(to_status="finished")
        .order_by("-created_at")
        .first()
    )
    if hist:
        return hist.created_at.date()
    return order.updated_at.date() if order.status == "finished" else None


def _status_since(order):
    hist = order.status_history.order_by("-created_at").first()
    ref = hist.created_at if hist else order.created_at
    return (timezone.now() - ref).days


def _spec(
    stype,
    category,
    priority,
    *,
    reason,
    action,
    customer=None,
    vehicle=None,
    work_order=None,
    quote=None,
    lead=None,
    channel=Channel.WHATSAPP,
    due_date=None,
    dedup,
):
    return {
        "suggestion_type": stype,
        "category": category,
        "priority": priority,
        "reason": reason[:300],
        "recommended_action": action[:200],
        "suggested_text": render_text(stype, customer, vehicle),
        "customer": customer,
        "vehicle": vehicle,
        "work_order": work_order,
        "quote": quote,
        "lead": lead,
        "channel": channel,
        "due_date": due_date,
        "dedup_key": dedup,
    }


# --- regras ---------------------------------------------------------------


def _rule_quote_followup(conf, today):
    from apps.quotes.models import Quote

    cutoff = timezone.now() - timedelta(days=conf.quote_followup_days)
    specs = []
    qs = Quote.objects.filter(
        status__in=["sent", "viewed"], sent_at__isnull=False, sent_at__lt=cutoff
    ).select_related("work_order", "work_order__customer", "work_order__vehicle")
    for q in qs:
        order = q.work_order
        specs.append(
            _spec(
                SuggestionType.QUOTE_FOLLOWUP,
                Category.QUOTE,
                Priority.HIGH,
                reason=f"Orçamento #{q.number} enviado há mais de {conf.quote_followup_days} dia(s) sem resposta.",
                action="Enviar mensagem cordial perguntando se há dúvidas.",
                customer=order.customer,
                vehicle=order.vehicle,
                work_order=order,
                quote=q,
                dedup=f"quote_followup:{q.id}",
            )
        )
    return specs


def _rule_quote_rejected(conf, today):
    from apps.quotes.models import Quote

    cutoff = timezone.now() - timedelta(days=conf.rejected_recovery_days)
    specs = []
    qs = Quote.objects.filter(
        status="rejected", decided_at__isnull=False, decided_at__lt=cutoff
    ).select_related("work_order", "work_order__customer", "work_order__vehicle")
    for q in qs:
        order = q.work_order
        specs.append(
            _spec(
                SuggestionType.QUOTE_REJECTED,
                Category.QUOTE,
                Priority.MEDIUM,
                reason=f"Orçamento #{q.number} recusado há mais de {conf.rejected_recovery_days} dia(s).",
                action="Follow-up educativo e não insistente sobre itens prioritários.",
                customer=order.customer,
                vehicle=order.vehicle,
                work_order=order,
                quote=q,
                dedup=f"quote_rejected:{q.id}",
            )
        )
    return specs


def _rule_quote_expiring(conf, today):
    from apps.quotes.models import Quote

    limit = today + timedelta(days=conf.quote_expiring_days)
    specs = []
    qs = Quote.objects.filter(
        status__in=["sent", "viewed"],
        valid_until__isnull=False,
        valid_until__gte=today,
        valid_until__lte=limit,
    ).select_related("work_order", "work_order__customer", "work_order__vehicle")
    for q in qs:
        order = q.work_order
        specs.append(
            _spec(
                SuggestionType.QUOTE_EXPIRING,
                Category.QUOTE,
                Priority.MEDIUM,
                reason=f"Orçamento #{q.number} vence em {q.valid_until.strftime('%d/%m/%Y')}.",
                action="Lembrar prazo de validade e oferecer ajuda.",
                customer=order.customer,
                vehicle=order.vehicle,
                work_order=order,
                quote=q,
                due_date=q.valid_until,
                dedup=f"quote_expiring:{q.id}",
            )
        )
    return specs


def _rule_os_ready(conf, today):
    from apps.orders.models import WorkOrder

    specs = []
    qs = WorkOrder.objects.filter(status="ready").select_related("customer", "vehicle")
    for o in qs:
        if _status_since(o) < conf.os_ready_days:
            continue
        specs.append(
            _spec(
                SuggestionType.OS_READY,
                Category.ORDER,
                Priority.HIGH,
                reason=f"OS #{o.number} pronta para retirada há {_status_since(o)} dia(s).",
                action="Enviar lembrete de retirada.",
                customer=o.customer,
                vehicle=o.vehicle,
                work_order=o,
                dedup=f"os_ready:{o.id}",
            )
        )
    return specs


def _rule_os_awaiting(conf, today):
    from apps.orders.models import WorkOrder

    specs = []
    qs = WorkOrder.objects.filter(status="awaiting_approval").select_related(
        "customer", "vehicle"
    )
    for o in qs:
        if _status_since(o) < conf.os_awaiting_days:
            continue
        specs.append(
            _spec(
                SuggestionType.OS_AWAITING_APPROVAL,
                Category.ORDER,
                Priority.HIGH,
                reason=f"OS #{o.number} aguardando aprovação há {_status_since(o)} dia(s).",
                action="Lembrar aprovação do orçamento.",
                customer=o.customer,
                vehicle=o.vehicle,
                work_order=o,
                dedup=f"os_awaiting:{o.id}",
            )
        )
    return specs


def _rule_os_stalled(conf, today):
    from apps.orders.models import WorkOrder

    watched = ["diagnosing", "in_progress", "awaiting_parts", "testing"]
    specs = []
    qs = WorkOrder.objects.filter(status__in=watched).select_related(
        "customer", "vehicle"
    )
    for o in qs:
        if _status_since(o) < conf.os_stalled_days:
            continue
        specs.append(
            _spec(
                SuggestionType.OS_STALLED,
                Category.ORDER,
                Priority.MEDIUM,
                reason=f'OS #{o.number} em "{o.get_status_display()}" há {_status_since(o)} dia(s).',
                action="Atualizar o cliente sobre o andamento.",
                customer=o.customer,
                vehicle=o.vehicle,
                work_order=o,
                dedup=f"os_stalled:{o.id}:{today}",
            )
        )
    return specs


def _rule_post_service(conf, today):
    from apps.orders.models import WorkOrder

    lo = today - timedelta(days=conf.post_service_days + 1)
    specs = []
    qs = WorkOrder.objects.filter(status="finished").select_related(
        "customer", "vehicle"
    )
    for o in qs:
        fd = _finished_date(o)
        if fd is None or not (
            lo <= fd <= today - timedelta(days=conf.post_service_days)
        ):
            continue
        specs.append(
            _spec(
                SuggestionType.POST_SERVICE,
                Category.POST_SERVICE,
                Priority.MEDIUM,
                reason=f"OS #{o.number} finalizada em {fd.strftime('%d/%m/%Y')}.",
                action="Agradecer e pedir avaliação; lembrar garantia.",
                customer=o.customer,
                vehicle=o.vehicle,
                work_order=o,
                dedup=f"post_service:{o.id}",
            )
        )
    return specs


def _rule_preventive(conf, today):
    from apps.orders.models import WorkOrder

    cutoff = today - timedelta(days=conf.preventive_months * 30)
    specs = []
    qs = WorkOrder.objects.filter(status="finished").select_related(
        "customer", "vehicle"
    )
    for o in qs:
        fd = _finished_date(o)
        if fd is None or fd > cutoff:
            continue
        # Só se não houver OS mais recente para o mesmo veículo.
        if (
            o.vehicle_id
            and WorkOrder.objects.filter(
                vehicle_id=o.vehicle_id, created_at__gt=o.created_at
            ).exists()
        ):
            continue
        specs.append(
            _spec(
                SuggestionType.PREVENTIVE,
                Category.OPPORTUNITY,
                Priority.LOW,
                reason=f"Último serviço do veículo há mais de {conf.preventive_months} meses.",
                action="Sugerir revisão preventiva / lembrete de manutenção.",
                customer=o.customer,
                vehicle=o.vehicle,
                work_order=o,
                dedup=f"preventive:{o.vehicle_id or o.id}:{today.year}-{today.month}",
            )
        )
    return specs


def _rule_inactive_customer(conf, today):
    from apps.customers.models import Customer
    from apps.orders.models import WorkOrder

    cutoff = timezone.now() - timedelta(days=conf.inactive_months * 30)
    specs = []
    for c in Customer.objects.filter(is_active=True):
        last = WorkOrder.objects.filter(customer=c).order_by("-created_at").first()
        if last is None or last.created_at >= cutoff:
            continue
        specs.append(
            _spec(
                SuggestionType.INACTIVE_CUSTOMER,
                Category.REACTIVATION,
                Priority.MEDIUM,
                reason=f"Cliente sem OS há mais de {conf.inactive_months} meses.",
                action="Mensagem de check-up / campanha de retorno.",
                customer=c,
                vehicle=last.vehicle,
                dedup=f"inactive:{c.id}:{today.year}-{today.month}",
            )
        )
    return specs


def _rule_lead_followup(conf, today):
    from apps.leads.models import LeadStatus, SiteLead

    cutoff = timezone.now() - timedelta(hours=conf.lead_sla_hours)
    specs = []
    for lead in SiteLead.objects.filter(status=LeadStatus.NEW, created_at__lt=cutoff):
        customer = lead.linked_customer
        specs.append(
            _spec(
                SuggestionType.LEAD_FOLLOWUP,
                Category.CONVERSATION,
                Priority.HIGH,
                reason=f"Pedido do site de {lead.name} sem contato há mais de {conf.lead_sla_hours}h.",
                action="Ligar/WhatsApp para o cliente do pedido.",
                customer=customer,
                lead=lead,
                channel=Channel.PHONE,
                dedup=f"lead_followup:{lead.id}:{today}",
            )
        )
    return specs


def _rule_seasonal(conf, today):
    if not conf.seasonal_campaigns_enabled:
        return []
    holiday = upcoming_holiday(conf, today)
    if holiday is None:
        return []
    d, name = holiday
    return [
        _spec(
            SuggestionType.SEASONAL_CAMPAIGN,
            Category.CAMPAIGN,
            Priority.MEDIUM,
            reason=f"{name} em {d.strftime('%d/%m/%Y')}. Boa época para campanha de revisão preventiva.",
            action="Criar campanha de revisão preventiva para viagem.",
            channel=Channel.WHATSAPP,
            dedup=f"seasonal:{d.isoformat()}",
        )
    ]


RULES = {
    SuggestionType.QUOTE_FOLLOWUP: _rule_quote_followup,
    SuggestionType.QUOTE_REJECTED: _rule_quote_rejected,
    SuggestionType.QUOTE_EXPIRING: _rule_quote_expiring,
    SuggestionType.OS_READY: _rule_os_ready,
    SuggestionType.OS_AWAITING_APPROVAL: _rule_os_awaiting,
    SuggestionType.OS_STALLED: _rule_os_stalled,
    SuggestionType.POST_SERVICE: _rule_post_service,
    SuggestionType.PREVENTIVE: _rule_preventive,
    SuggestionType.INACTIVE_CUSTOMER: _rule_inactive_customer,
    SuggestionType.LEAD_FOLLOWUP: _rule_lead_followup,
    SuggestionType.SEASONAL_CAMPAIGN: _rule_seasonal,
}


def _upsert(spec):
    """Cria a sugestão se a dedup_key ainda não existe. Retorna a criada ou None."""
    dedup = spec["dedup_key"]
    if dedup and CrmSuggestion.objects.filter(dedup_key=dedup).exists():
        return None
    return CrmSuggestion.objects.create(status=SuggestionStatus.NEW, **spec)


def run_rules(today=None):
    """Executa todas as regras ativas; devolve as sugestões criadas."""
    conf = CrmSettings.get_solo()
    if not conf.is_active:
        return []
    today = today or timezone.localdate()
    active = set(conf.active_types) if conf.active_types else None
    created = []
    for stype, rule in RULES.items():
        if active is not None and stype not in active:
            continue
        try:
            for spec in rule(conf, today):
                if len(created) >= conf.daily_limit:
                    break
                obj = _upsert(spec)
                if obj is not None:
                    created.append(obj)
        except Exception:  # pragma: no cover - uma regra não derruba as outras
            import logging

            logging.getLogger("apps.crm").exception("Falha na regra %s", stype)
    _notify(created)
    return created


def _notify(suggestions):
    """Avisa a equipe (Central de Notificações) sobre sugestões de alta prioridade."""
    high = [s for s in suggestions if s.priority in ("high", "urgent")]
    if not high:
        return
    try:
        from apps.alerts.models import NotifType
        from apps.alerts.services import emit

        for s in high:
            emit(
                NotifType.CRM_SUGGESTION,
                title="Nova sugestão do CRM inteligente",
                message=s.reason,
                related_type="CrmSuggestion",
                related_id=s.id,
                url="/crm",
                action_label="Ver sugestão",
                dedup_key=f"crm_suggestion:{s.id}",
            )
    except Exception:  # pragma: no cover
        import logging

        logging.getLogger("apps.crm").exception("Falha ao notificar sugestões do CRM")
