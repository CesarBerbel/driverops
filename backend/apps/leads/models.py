from django.conf import settings
from django.db import models

from apps.core.models import SingletonModel


class RequestType(models.TextChoices):
    DIAGNOSTIC = "diagnostic", "Diagnóstico"
    REVISION = "revision", "Revisão"
    QUOTE = "quote", "Orçamento"
    PREVENTIVE = "preventive", "Manutenção preventiva"
    MECHANICAL = "mechanical", "Problema mecânico"
    ELECTRICAL = "electrical", "Problema elétrico"
    BRAKES = "brakes", "Freios"
    SUSPENSION = "suspension", "Suspensão"
    AC = "ac", "Ar-condicionado"
    OTHER = "other", "Outro"


class ContactPeriod(models.TextChoices):
    MORNING = "morning", "Manhã"
    AFTERNOON = "afternoon", "Tarde"
    EVENING = "evening", "Noite"
    ANY = "any", "Qualquer horário"


class LeadStatus(models.TextChoices):
    NEW = "new", "Novo"
    IN_ANALYSIS = "in_analysis", "Em análise"
    CONTACTED = "contacted", "Cliente contatado"
    AWAITING_RETURN = "awaiting_return", "Aguardando retorno"
    CONVERTED_CUSTOMER = "converted_customer", "Convertido em cliente"
    # Status manual: o projeto não tem módulo de agenda; marcar aqui indica que
    # o atendente agendou por fora (telefone/WhatsApp). Não há criação automática.
    CONVERTED_APPOINTMENT = "converted_appointment", "Convertido em agendamento"
    CONVERTED_OS = "converted_os", "Convertido em OS"
    CONVERTED_QUOTE = "converted_quote", "Convertido em orçamento"
    DUPLICATE = "duplicate", "Duplicado"
    NO_SUCCESS = "no_success", "Sem sucesso"
    CANCELED = "canceled", "Cancelado"


# Status terminais (não contam como "pendentes" no inbox/badge).
CLOSED_STATUSES = [
    LeadStatus.CONVERTED_CUSTOMER,
    LeadStatus.CONVERTED_APPOINTMENT,
    LeadStatus.CONVERTED_OS,
    LeadStatus.CONVERTED_QUOTE,
    LeadStatus.DUPLICATE,
    LeadStatus.NO_SUCCESS,
    LeadStatus.CANCELED,
]


class LeadSettings(SingletonModel):
    """Configuração do formulário público e do fluxo de pedidos (registro único)."""

    is_active = models.BooleanField(default=True)
    email_required = models.BooleanField(default=False)
    plate_required = models.BooleanField(default=True)
    allow_without_vehicle = models.BooleanField(default=False)
    require_consent = models.BooleanField(default=True)
    sla_hours = models.PositiveIntegerField(default=2)
    auto_reply_enabled = models.BooleanField(default=False)
    notify_email = models.BooleanField(default=False)
    allow_create_os = models.BooleanField(default=True)
    require_review_on_divergence = models.BooleanField(default=True)
    block_conversion_when_vehicle_other_customer = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_settings_updated",
    )

    def __str__(self):
        return "Configurações de Pedidos do Site"


class SiteLead(models.Model):
    """Pedido de contato/atendimento enviado pelo site (lead)."""

    # Dados do cliente informados no formulário.
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=11)
    email = models.EmailField(blank=True)
    document = models.CharField(max_length=14, blank=True)

    # Dados do veículo informados.
    vehicle_plate = models.CharField(max_length=7, blank=True)
    vehicle_brand = models.CharField(max_length=100, blank=True)
    vehicle_model = models.CharField(max_length=100, blank=True)
    vehicle_year = models.PositiveSmallIntegerField(null=True, blank=True)
    vehicle_mileage = models.PositiveIntegerField(null=True, blank=True)

    request_type = models.CharField(
        max_length=20, choices=RequestType.choices, default=RequestType.OTHER
    )
    best_period = models.CharField(
        max_length=20, choices=ContactPeriod.choices, default=ContactPeriod.ANY
    )
    desired_date = models.DateField(null=True, blank=True)
    message = models.TextField(blank=True)
    consent = models.BooleanField(default=False)

    status = models.CharField(
        max_length=24, choices=LeadStatus.choices, default=LeadStatus.NEW, db_index=True
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
    )
    linked_customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="site_leads",
    )
    linked_vehicle = models.ForeignKey(
        "vehicles.Vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="site_leads",
    )
    work_order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="site_leads",
    )
    source = models.CharField(max_length=20, default="site")
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} · {self.vehicle_plate or 's/ veículo'} ({self.get_status_display()})"

    @property
    def is_open(self):
        return self.status not in CLOSED_STATUSES


class LeadEvent(models.Model):
    """Linha do tempo do pedido: mudanças de status, contatos, notas e conversões."""

    class Type(models.TextChoices):
        CREATED = "created", "Pedido criado"
        STATUS = "status", "Status alterado"
        ASSIGN = "assign", "Responsável alterado"
        NOTE = "note", "Observação interna"
        CONTACT = "contact", "Contato registrado"
        LINK_CUSTOMER = "link_customer", "Cliente vinculado"
        CREATE_CUSTOMER = "create_customer", "Cliente criado"
        LINK_VEHICLE = "link_vehicle", "Veículo vinculado"
        CREATE_VEHICLE = "create_vehicle", "Veículo criado"
        CONVERT_OS = "convert_os", "OS gerada"
        CONVERT_QUOTE = "convert_quote", "Orçamento gerado"
        NOTIFY = "notify", "Notificação enviada"

    lead = models.ForeignKey(SiteLead, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_events",
    )
    event_type = models.CharField(max_length=20, choices=Type.choices)
    description = models.CharField(max_length=300, blank=True)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_event_type_display()} · {self.lead_id}"
