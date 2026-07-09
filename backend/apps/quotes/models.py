import secrets

from django.conf import settings
from django.db import models, transaction

from apps.core.locks import assign_next_number


def generate_token():
    """Token público seguro e não sequencial para o link de aprovação."""
    return secrets.token_urlsafe(32)


class Quote(models.Model):
    """Orçamento gerado a partir de uma Ordem de Serviço.

    Cada orçamento é um **snapshot** dos itens e valores da OS no momento da
    criação -- alterações posteriores na OS não afetam um orçamento já criado
    (muito menos um aprovado). Para revisar após mudanças na OS, cria-se uma
    **nova versão** (novo Quote com ``version`` incrementado); as versões
    anteriores permanecem para consulta/histórico. Orçamentos nunca são apagados
    fisicamente pela interface (``is_active``/``cancelado``).
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Rascunho"
        SENT = "sent", "Enviado"
        VIEWED = "viewed", "Visualizado"
        PARTIALLY_APPROVED = "partially_approved", "Aprovado parcialmente"
        APPROVED = "approved", "Aprovado integralmente"
        REJECTED = "rejected", "Recusado"
        EXPIRED = "expired", "Expirado"
        CANCELED = "canceled", "Cancelado"

    class Channel(models.TextChoices):
        PHYSICAL = "physical", "Assinatura física"
        TABLET = "tablet", "Assinatura no tablet"
        EMAIL_LINK = "email_link", "Link por e-mail"

    # Estados terminais: não permitem nova decisão nem edição direta (exige nova
    # versão). Aprovação parcial também é terminal para aquela versão.
    TERMINAL_STATUSES = [
        "partially_approved",
        "approved",
        "rejected",
        "expired",
        "canceled",
    ]
    # Estados que já representam uma decisão do cliente (aprovação/recusa).
    DECIDED_STATUSES = ["partially_approved", "approved", "rejected"]
    # Estados em que o cliente ainda pode decidir pelo link público.
    DECIDABLE_STATUSES = ["sent", "viewed"]
    # Estados "em aberto": rascunho, enviado ou em análise/aguardando aprovação.
    # Enquanto existir um orçamento nesses estados para a OS, não se pode criar
    # outro -- o atual precisa ser decidido (aprovado/recusado) ou cancelado.
    OPEN_STATUSES = ["draft", "sent", "viewed"]

    work_order = models.ForeignKey(
        "orders.WorkOrder", on_delete=models.CASCADE, related_name="quotes"
    )
    # Número sequencial global do documento (como a OS). Atribuído no 1º save.
    number = models.PositiveIntegerField(unique=True, editable=False)
    # Revisão dentro da mesma OS (1, 2, 3...). Atribuída pela view na criação.
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True
    )

    # --- snapshot do contexto da OS (congelado) ---
    customer_report = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    discount_type = models.CharField(max_length=10, default="none")
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    valid_until = models.DateField(null=True, blank=True)
    public_token = models.CharField(
        max_length=64, unique=True, default=generate_token, editable=False
    )

    # --- auditoria ---
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes_sent",
    )
    sent_to_email = models.EmailField(blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)

    # Decisão (aprovação/recusa)
    decided_at = models.DateTimeField(null=True, blank=True)
    approval_channel = models.CharField(
        max_length=20, choices=Channel.choices, blank=True
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes_approved",
    )
    client_name = models.CharField(max_length=200, blank=True)
    terms_accepted = models.BooleanField(default=False)
    rejection_reason = models.TextField(blank=True)
    decision_ip = models.GenericIPAddressField(null=True, blank=True)
    decision_user_agent = models.TextField(blank=True)
    approval_note = models.TextField(blank=True)

    # Assinatura digital (tablet) e digitalização da via assinada fisicamente.
    signature_image = models.FileField(
        upload_to="quotes/signatures/", null=True, blank=True
    )
    signed_document = models.FileField(
        upload_to="quotes/signed/", null=True, blank=True
    )

    # Soft delete (nunca apagado fisicamente pela interface).
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-number"]

    def __str__(self):
        return f"Orçamento #{self.number} (v{self.version})"

    def save(self, *args, **kwargs):
        if not self.number:
            with transaction.atomic():
                assign_next_number(self, lock_name="quotes.quote.number")
                super().save(*args, **kwargs)
            return
        super().save(*args, **kwargs)

    @property
    def is_terminal(self):
        return self.status in self.TERMINAL_STATUSES


class QuoteItem(models.Model):
    """Linha do orçamento -- snapshot de um item da OS.

    ``description`` e ``unit_price`` são congelados no momento da geração do
    orçamento, preservando o histórico mesmo que o item cadastrado mude depois.
    ``is_custom`` indica item avulso (sem vínculo com o catálogo).
    """

    class Kind(models.TextChoices):
        SERVICE = "service", "Serviço"
        PACKAGE = "package", "Pacote"
        PART = "part", "Peça"

    class ItemStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        APPROVED = "approved", "Aprovado"
        REJECTED = "rejected", "Recusado"

    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="items")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_custom = models.BooleanField(default=False)
    notes = models.CharField(max_length=200, blank=True)
    # Decisão individual do cliente (aprovação parcial). "pending" até a decisão.
    status = models.CharField(
        max_length=10, choices=ItemStatus.choices, default=ItemStatus.PENDING
    )
    # Peça vinculada a um serviço (peça padrão do serviço). Itens vinculados são
    # aprovados/recusados **em conjunto** com o serviço -- não se pode recusar um
    # sem o outro. Nulo para serviços, pacotes e peças avulsas/independentes.
    linked_service = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_parts",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.description
