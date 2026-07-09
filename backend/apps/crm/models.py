"""CRM Inteligente: sugestões de próxima melhor ação (Next Best Action).

Combina um motor de **regras determinísticas** (identifica oportunidades por
prazo/status) com **IA** (gera o texto da abordagem, sob revisão humana). Nada é
enviado automaticamente: o sistema sugere, o usuário aprova. Projeto de oficina
única (sem multi-tenant); escopo por permissão.
"""

from django.conf import settings
from django.db import models

from apps.core.models import SingletonModel


class SuggestionType(models.TextChoices):
    QUOTE_FOLLOWUP = "quote_followup", "Follow-up de orçamento"
    QUOTE_REJECTED = "quote_rejected", "Recuperação de orçamento recusado"
    QUOTE_EXPIRING = "quote_expiring", "Orçamento perto de expirar"
    OS_READY = "os_ready", "OS pronta para retirada"
    OS_AWAITING_APPROVAL = "os_awaiting_approval", "OS aguardando aprovação"
    OS_STALLED = "os_stalled", "OS parada no status"
    POST_SERVICE = "post_service", "Pós-serviço"
    PREVENTIVE = "preventive", "Revisão preventiva"
    INACTIVE_CUSTOMER = "inactive_customer", "Cliente inativo"
    LEAD_FOLLOWUP = "lead_followup", "Follow-up de pedido do site"
    SEASONAL_CAMPAIGN = "seasonal_campaign", "Campanha sazonal"
    MANUAL = "manual", "Sugestão manual"


class Category(models.TextChoices):
    CONVERSATION = "conversation", "Follow-up de conversa"
    QUOTE = "quote", "Orçamento"
    ORDER = "order", "Ordem de Serviço"
    REACTIVATION = "reactivation", "Reativação"
    CAMPAIGN = "campaign", "Campanha"
    OPPORTUNITY = "opportunity", "Oportunidade por histórico"
    POST_SERVICE = "post_service", "Pós-serviço"


class Priority(models.TextChoices):
    LOW = "low", "Baixa"
    MEDIUM = "medium", "Média"
    HIGH = "high", "Alta"
    URGENT = "urgent", "Urgente"


PRIORITY_ORDER = {"low": 0, "medium": 1, "high": 2, "urgent": 3}


class SuggestionStatus(models.TextChoices):
    NEW = "new", "Nova"
    IN_ANALYSIS = "in_analysis", "Em análise"
    SCHEDULED = "scheduled", "Agendada"
    IN_PROGRESS = "in_progress", "Em andamento"
    SENT = "sent", "Enviada"
    COMPLETED = "completed", "Concluída"
    IGNORED = "ignored", "Ignorada"
    SNOOZED = "snoozed", "Adiada"
    EXPIRED = "expired", "Expirada"
    CANCELED = "canceled", "Cancelada"


OPEN_STATUSES = ["new", "in_analysis", "scheduled", "in_progress", "snoozed"]
CLOSED_STATUSES = ["sent", "completed", "ignored", "expired", "canceled"]


class Channel(models.TextChoices):
    WHATSAPP = "whatsapp", "WhatsApp"
    EMAIL = "email", "E-mail"
    PHONE = "phone", "Ligação"
    NONE = "none", "—"


class Source(models.TextChoices):
    RULE = "rule", "Regra"
    AI = "ai", "IA"
    MANUAL = "manual", "Manual"


class TaskStatus(models.TextChoices):
    OPEN = "open", "Aberta"
    DONE = "done", "Concluída"
    CANCELED = "canceled", "Cancelada"


class CampaignStatus(models.TextChoices):
    DRAFT = "draft", "Rascunho"
    APPROVED = "approved", "Aprovada"
    SENT = "sent", "Enviada"
    CANCELED = "canceled", "Cancelada"


DEFAULT_GLOBAL_PROMPT = (
    "Você é um assistente de CRM para uma oficina mecânica. Sua função é sugerir "
    "ações de relacionamento com clientes com base em dados reais do sistema, como "
    "status da OS, orçamento, histórico de atendimento, prazos e campanhas "
    "sazonais.\n\n"
    "Nunca invente informações. Nunca prometa desconto, prazo, diagnóstico, "
    "garantia ou serviço que não esteja registrado. Nunca use tom alarmista ou "
    "pressão excessiva. Sugira ações úteis, éticas e profissionais.\n\n"
    "Quando gerar mensagens para clientes, use linguagem clara, cordial e "
    "objetiva. A mensagem deve ser revisada por um usuário da oficina antes do "
    "envio. Não exponha observações internas, dados sensíveis ou informações "
    "financeiras sem autorização."
)


class CrmSettings(SingletonModel):
    """Configuração do CRM inteligente (registro único)."""

    is_active = models.BooleanField(default=True)
    tone = models.CharField(max_length=20, default="cordial")
    global_prompt = models.TextField(default=DEFAULT_GLOBAL_PROMPT)

    # Politicas (nunca envia sozinho por padrao).
    allow_ai_messages = models.BooleanField(default=True)
    use_os_data = models.BooleanField(default=True)
    use_financial_data = models.BooleanField(default=False)
    auto_send_messages = models.BooleanField(default=False)
    auto_create_tasks = models.BooleanField(default=False)
    seasonal_campaigns_enabled = models.BooleanField(default=True)
    daily_limit = models.PositiveIntegerField(default=100)

    # Regras de tempo (dias, salvo indicado).
    lead_sla_hours = models.PositiveIntegerField(default=4)
    quote_followup_days = models.PositiveIntegerField(default=2)
    quote_expiring_days = models.PositiveIntegerField(default=2)
    rejected_recovery_days = models.PositiveIntegerField(default=7)
    os_ready_days = models.PositiveIntegerField(default=1)
    os_awaiting_days = models.PositiveIntegerField(default=2)
    os_stalled_days = models.PositiveIntegerField(default=3)
    post_service_days = models.PositiveIntegerField(default=2)
    preventive_months = models.PositiveIntegerField(default=6)
    inactive_months = models.PositiveIntegerField(default=6)
    holiday_lead_days = models.PositiveIntegerField(default=15)

    # Tipos ativos (vazio = todos) e feriados customizados [{date, name}].
    active_types = models.JSONField(default=list, blank=True)
    custom_holidays = models.JSONField(default=list, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )


class CrmSuggestion(models.Model):
    suggestion_type = models.CharField(max_length=30, choices=SuggestionType.choices)
    category = models.CharField(max_length=20, choices=Category.choices)
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    status = models.CharField(
        max_length=20,
        choices=SuggestionStatus.choices,
        default=SuggestionStatus.NEW,
        db_index=True,
    )

    # Opcional: campanhas sazonais não são de um único cliente.
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="crm_suggestions",
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    work_order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    lead = models.ForeignKey(
        "leads.SiteLead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    reason = models.CharField(max_length=300)
    recommended_action = models.CharField(max_length=200)
    suggested_text = models.TextField(blank=True)
    channel = models.CharField(
        max_length=12, choices=Channel.choices, default=Channel.WHATSAPP
    )
    due_date = models.DateField(null=True, blank=True)
    snoozed_until = models.DateField(null=True, blank=True)

    source = models.CharField(
        max_length=10, choices=Source.choices, default=Source.RULE
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crm_suggestions",
    )
    data = models.JSONField(default=dict, blank=True)
    dedup_key = models.CharField(max_length=200, blank=True, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["dedup_key"],
                condition=~models.Q(dedup_key=""),
                name="uniq_crm_suggestion_dedup",
            )
        ]

    def __str__(self):
        return f"{self.get_suggestion_type_display()} — {self.customer_id}"


class CrmSuggestionEvent(models.Model):
    suggestion = models.ForeignKey(
        CrmSuggestion, on_delete=models.CASCADE, related_name="events"
    )
    description = models.CharField(max_length=300)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class CrmTask(models.Model):
    title = models.CharField(max_length=200)
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="crm_tasks"
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    work_order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    suggestion = models.ForeignKey(
        CrmSuggestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crm_tasks",
    )
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    status = models.CharField(
        max_length=12, choices=TaskStatus.choices, default=TaskStatus.OPEN
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class CrmCampaign(models.Model):
    name = models.CharField(max_length=150)
    segment_key = models.CharField(max_length=40, blank=True)
    channel = models.CharField(
        max_length=12, choices=Channel.choices, default=Channel.WHATSAPP
    )
    message = models.TextField(blank=True)
    status = models.CharField(
        max_length=12, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT
    )
    audience_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
