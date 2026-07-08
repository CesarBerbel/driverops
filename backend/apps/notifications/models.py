from django.conf import settings
from django.db import models

from .events import EVENT_CHOICES, EVENT_CONTEXT
from .defaults import default_template


class NotificationTemplate(models.Model):
    """Template de notificação ao cliente para um par (evento, canal).

    O conteúdo aqui é o que efetivamente é enviado. Os textos "de fábrica" vivem
    em :mod:`apps.notifications.defaults`; ``is_customized`` indica se a oficina
    divergiu do padrão. *Restaurar padrão* reescreve os campos a partir do
    default e zera ``is_customized`` -- por isso o padrão do sistema está sempre
    disponível para restauração.
    """

    class Channel(models.TextChoices):
        EMAIL = "email", "E-mail"
        WHATSAPP = "whatsapp", "WhatsApp"
        SMS = "sms", "SMS"
        INTERNAL = "internal", "Notificação interna"

    event = models.CharField(max_length=40, choices=EVENT_CHOICES)
    channel = models.CharField(max_length=20, choices=Channel.choices)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    html_content = models.TextField(blank=True)
    text_content = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    # Divergiu do template de fábrica? Falso logo após semear ou restaurar.
    is_customized = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_templates_updated",
    )

    class Meta:
        unique_together = [("event", "channel")]
        ordering = ["event", "channel"]

    def __str__(self):
        return f"{self.get_event_display()} · {self.get_channel_display()}"

    @property
    def context_kind(self):
        return EVENT_CONTEXT.get(self.event)

    def apply_default(self):
        """Reescreve os campos de conteúdo a partir do template de fábrica."""
        fields = default_template(self.event, self.channel)
        self.name = fields["name"]
        self.description = fields["description"]
        self.subject = fields["subject"]
        self.html_content = fields["html_content"]
        self.text_content = fields["text_content"]
        self.is_customized = False


class NotificationLog(models.Model):
    """Registro de cada tentativa de envio de notificação ao cliente.

    Guarda sucesso e falha (com a mensagem de erro), o canal, o destinatário e o
    vínculo com a OS/orçamento quando houver. Serve de trilha operacional dos
    envios (a auditoria de *alterações* de template usa ``accounts.AuditLog``).
    """

    class Status(models.TextChoices):
        SENT = "sent", "Enviado"
        FAILED = "failed", "Falhou"
        SKIPPED = "skipped", "Ignorado"

    event = models.CharField(max_length=40)
    channel = models.CharField(max_length=20)
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    recipient = models.CharField(max_length=200, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    error = models.TextField(blank=True)
    is_test = models.BooleanField(default=False)
    work_order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notification_logs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event}/{self.channel} → {self.recipient} ({self.status})"
