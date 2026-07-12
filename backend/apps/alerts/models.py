"""Central de Notificações Interna (avisos operacionais do sistema).

Diferente de ``apps.notifications`` (templates enviados ao *cliente*), este app
gera avisos *internos* para os usuários da oficina: novos pedidos do site, OS
vencendo/atrasadas, orçamentos pendentes, estoque crítico etc.

Modelo de entrega: **uma linha por destinatário** (fan-out no momento da
criação). Isso mantém leitura/contador/filtros triviais e corretos por usuário,
e a deduplicação simples (chave única por destinatário + ``dedup_key``). O
projeto é de oficina única (sem multi-tenant), então o escopo é por usuário e
permissão de módulo -- ver ``services.resolve_recipients``.
"""

from django.conf import settings
from django.db import models


class NotifType(models.TextChoices):
    SITE_LEAD_CREATED = "site_lead_created", "Novo pedido do site"
    SITE_LEAD_SLA = "site_lead_sla", "Pedido do site aguardando contato"
    OS_DUE_SOON = "os_due_soon", "OS próxima do vencimento"
    OS_OVERDUE = "os_overdue", "OS atrasada"
    OS_STALLED = "os_stalled", "OS parada no mesmo status"
    QUOTE_PENDING = "quote_pending", "Orçamento aguardando resposta"
    QUOTE_APPROVED = "quote_approved", "Orçamento aprovado"
    QUOTE_REJECTED = "quote_rejected", "Orçamento recusado"
    PAYMENTS_TODAY = "payments_today", "Pagamentos registrados hoje"
    PAYMENTS_PENDING = "payments_pending", "OS com pagamento pendente"
    RECEIVABLES_OVERDUE = "receivables_overdue", "Contas a receber vencidas"
    STOCK_LOW = "stock_low", "Estoque abaixo do mínimo"
    CRM_SUGGESTION = "crm_suggestion", "Sugestão do CRM inteligente"
    MANUAL = "manual", "Aviso manual"
    ADMIN = "admin", "Aviso administrativo"


class NotifModule(models.TextChoices):
    LEADS = "leads", "Site/Pedidos"
    ORDERS = "orders", "Ordem de Serviço"
    QUOTES = "quotes", "Orçamentos"
    FINANCIAL = "financial", "Financeiro"
    PARTS = "parts", "Estoque"
    CRM = "crm", "CRM inteligente"
    SYSTEM = "system", "Sistema"
    ADMIN = "admin", "Administrativo"


class NotifPriority(models.TextChoices):
    INFO = "info", "Informativa"
    ATTENTION = "attention", "Atenção"
    IMPORTANT = "important", "Importante"
    URGENT = "urgent", "Urgente"
    CRITICAL = "critical", "Crítica"


class NotifStatus(models.TextChoices):
    UNREAD = "unread", "Não lida"
    READ = "read", "Lida"
    ARCHIVED = "archived", "Arquivada"


class NotifOrigin(models.TextChoices):
    AUTOMATIC = "automatic", "Automática"
    MANUAL = "manual", "Manual"
    SYSTEM = "system", "Sistema"


# Ordem para comparar prioridades (ex.: "somente alta prioridade").
PRIORITY_ORDER = {
    NotifPriority.INFO: 0,
    NotifPriority.ATTENTION: 1,
    NotifPriority.IMPORTANT: 2,
    NotifPriority.URGENT: 3,
    NotifPriority.CRITICAL: 4,
}
HIGH_PRIORITY = {NotifPriority.IMPORTANT, NotifPriority.URGENT, NotifPriority.CRITICAL}

# Cada tipo pertence a um módulo (governa quem recebe e o ícone).
TYPE_MODULE = {
    NotifType.SITE_LEAD_CREATED: NotifModule.LEADS,
    NotifType.SITE_LEAD_SLA: NotifModule.LEADS,
    NotifType.OS_DUE_SOON: NotifModule.ORDERS,
    NotifType.OS_OVERDUE: NotifModule.ORDERS,
    NotifType.OS_STALLED: NotifModule.ORDERS,
    NotifType.QUOTE_PENDING: NotifModule.QUOTES,
    NotifType.QUOTE_APPROVED: NotifModule.QUOTES,
    NotifType.QUOTE_REJECTED: NotifModule.QUOTES,
    NotifType.PAYMENTS_TODAY: NotifModule.FINANCIAL,
    NotifType.PAYMENTS_PENDING: NotifModule.FINANCIAL,
    NotifType.RECEIVABLES_OVERDUE: NotifModule.FINANCIAL,
    NotifType.STOCK_LOW: NotifModule.PARTS,
    NotifType.CRM_SUGGESTION: NotifModule.CRM,
    NotifType.MANUAL: NotifModule.SYSTEM,
    NotifType.ADMIN: NotifModule.ADMIN,
}

# Prioridade padrão de cada tipo (editável por regra).
DEFAULT_PRIORITY = {
    NotifType.SITE_LEAD_CREATED: NotifPriority.IMPORTANT,
    NotifType.SITE_LEAD_SLA: NotifPriority.URGENT,
    NotifType.OS_DUE_SOON: NotifPriority.IMPORTANT,
    NotifType.OS_OVERDUE: NotifPriority.URGENT,
    NotifType.OS_STALLED: NotifPriority.ATTENTION,
    NotifType.QUOTE_PENDING: NotifPriority.ATTENTION,
    NotifType.QUOTE_APPROVED: NotifPriority.INFO,
    NotifType.QUOTE_REJECTED: NotifPriority.ATTENTION,
    NotifType.PAYMENTS_TODAY: NotifPriority.INFO,
    NotifType.PAYMENTS_PENDING: NotifPriority.ATTENTION,
    NotifType.RECEIVABLES_OVERDUE: NotifPriority.URGENT,
    NotifType.STOCK_LOW: NotifPriority.IMPORTANT,
    NotifType.CRM_SUGGESTION: NotifPriority.IMPORTANT,
    NotifType.MANUAL: NotifPriority.IMPORTANT,
    NotifType.ADMIN: NotifPriority.IMPORTANT,
}

# Permissão de módulo que o destinatário precisa ter para receber/ver o aviso.
# ``alerts.view`` (o gate da central) é sempre exigido além disto.
MODULE_PERMISSION = {
    NotifModule.LEADS: "leads.view",
    NotifModule.ORDERS: "orders.view",
    NotifModule.QUOTES: "quotes.view",
    NotifModule.FINANCIAL: "alerts.view_financial",
    NotifModule.PARTS: "parts.view",
    NotifModule.CRM: "crm.view",
    NotifModule.SYSTEM: None,
    NotifModule.ADMIN: "alerts.view_admin",
}


class Notification(models.Model):
    """Um aviso interno para um destinatário. Sempre individual (fan-out)."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    # Papel que motivou o envio (só para exibir "você recebeu por ser ...").
    audience_role = models.ForeignKey(
        "accounts.Role", on_delete=models.SET_NULL, null=True, blank=True
    )
    notif_type = models.CharField(max_length=32, choices=NotifType.choices)
    module = models.CharField(max_length=20, choices=NotifModule.choices)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500)
    detail = models.TextField(blank=True)
    priority = models.CharField(
        max_length=20, choices=NotifPriority.choices, default=NotifPriority.IMPORTANT
    )
    status = models.CharField(
        max_length=20, choices=NotifStatus.choices, default=NotifStatus.UNREAD
    )
    read_at = models.DateTimeField(null=True, blank=True)

    # Entidade relacionada + rota interna de destino.
    related_type = models.CharField(max_length=60, blank=True)
    related_id = models.PositiveIntegerField(null=True, blank=True)
    url = models.CharField(max_length=300, blank=True)
    action_label = models.CharField(max_length=80, blank=True)
    data = models.JSONField(default=dict, blank=True)

    origin = models.CharField(
        max_length=20, choices=NotifOrigin.choices, default=NotifOrigin.AUTOMATIC
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    # Chave de deduplicação: única por destinatário quando preenchida.
    dedup_key = models.CharField(max_length=200, blank=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "status"]),
            models.Index(fields=["recipient", "module"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "dedup_key"],
                condition=~models.Q(dedup_key=""),
                name="uniq_recipient_dedup_key",
            )
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title} -> {self.recipient_id}"

    @property
    def is_read(self):
        return self.status == NotifStatus.READ


class NotificationRule(models.Model):
    """Configuração por tipo de aviso (o que a oficina quer receber e como)."""

    notif_type = models.CharField(max_length=32, choices=NotifType.choices, unique=True)
    is_enabled = models.BooleanField(default=True)
    priority = models.CharField(max_length=20, choices=NotifPriority.choices)
    # Antecedência (OS vencendo) ou SLA em horas (pedido do site sem contato).
    lead_time_hours = models.PositiveIntegerField(default=24)
    # Tempo (dias) parado no mesmo status / orçamento sem resposta.
    stall_days = models.PositiveIntegerField(default=2)
    # Papéis destinatários (chaves de Role). Vazio => por permissão de módulo.
    recipient_roles = models.JSONField(default=list, blank=True)
    show_in_bell = models.BooleanField(default=True)
    send_email = models.BooleanField(default=False)
    show_in_dashboard = models.BooleanField(default=False)
    group_similar = models.BooleanField(default=False)
    # Expiração automática (dias). 0 = nunca expira.
    auto_expire_days = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ["notif_type"]

    def __str__(self):
        return self.get_notif_type_display()

    @classmethod
    def get_for(cls, notif_type):
        rule, _ = cls.objects.get_or_create(
            notif_type=notif_type,
            defaults={
                "priority": DEFAULT_PRIORITY.get(notif_type, NotifPriority.IMPORTANT)
            },
        )
        return rule


class NotificationPreference(models.Model):
    """Preferências individuais do usuário (não ampliam permissões)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_pref",
    )
    muted_modules = models.JSONField(default=list, blank=True)
    only_assigned = models.BooleanField(default=False)
    only_high_priority = models.BooleanField(default=False)
    mute_informational = models.BooleanField(default=False)
    sound_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferências de {self.user_id}"

    @classmethod
    def get_for(cls, user):
        pref, _ = cls.objects.get_or_create(user=user)
        return pref
