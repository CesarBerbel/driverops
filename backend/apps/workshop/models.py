from django.core.validators import FileExtensionValidator
from django.db import models

# Raster formats only -- SVG is intentionally excluded because it can carry
# scripts and is served from the backend origin.
LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]

# Default term/text bodies seeded on the first read so the OS documents already
# have usable content in development. They can be edited freely afterwards.
DEFAULT_WARRANTY_TERMS = (
    "Os serviços executados possuem garantia de 90 (noventa) dias a partir da data "
    "de entrega do veículo, cobrindo exclusivamente os itens descritos nesta ordem "
    "de serviço. A garantia não cobre desgaste natural, mau uso ou intervenções "
    "realizadas por terceiros."
)
DEFAULT_QUOTE_TERMS = (
    "Este orçamento tem validade de 7 (sete) dias. Os valores podem ser revistos "
    "caso sejam identificados serviços ou peças adicionais durante a execução, "
    "sempre mediante nova aprovação do cliente."
)
DEFAULT_SERVICE_AUTHORIZATION_TERMS = (
    "Autorizo a execução dos serviços descritos nesta ordem de serviço, bem como a "
    "utilização das peças relacionadas, declarando estar ciente dos valores e prazos "
    "informados."
)
DEFAULT_CUSTOMER_ACKNOWLEDGMENT_TERMS = (
    "Declaro que retirei o veículo em perfeito estado de funcionamento, ciente dos "
    "serviços realizados e das condições de garantia aplicáveis."
)
DEFAULT_PDF_FOOTER_TEXT = "Documento gerado eletronicamente pelo sistema DriverOps."


class SingletonModel(models.Model):
    """Base para modelos de configuração com um único registro (pk=1)."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class WorkshopProfile(SingletonModel):
    """Dados institucionais da oficina, usados nos cabeçalhos/rodapés dos PDFs.

    Registro único (pk=1). Campos brasileiros (CNPJ, CEP, telefone/WhatsApp) são
    armazenados normalizados (somente dígitos) -- ver WorkshopProfileSerializer.
    """

    trade_name = models.CharField(max_length=150, blank=True)  # nome fantasia
    legal_name = models.CharField(max_length=200, blank=True)  # razão social
    cnpj = models.CharField(max_length=14, blank=True)
    state_registration = models.CharField(
        max_length=20, blank=True
    )  # inscrição estadual
    responsible = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=11, blank=True)
    whatsapp = models.CharField(max_length=11, blank=True)
    website = models.CharField(max_length=200, blank=True)
    # Logo enviado por upload (arquivo de imagem). Servido via MEDIA em dev.
    logo = models.FileField(
        upload_to="workshop/logos/",
        blank=True,
        null=True,
        validators=[FileExtensionValidator(LOGO_EXTENSIONS)],
    )
    zip_code = models.CharField(max_length=8, blank=True)
    street = models.CharField(max_length=200, blank=True)
    number = models.CharField(max_length=20, blank=True)
    complement = models.CharField(max_length=100, blank=True)
    neighborhood = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)
    country = models.CharField(max_length=60, blank=True, default="Brasil")
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.trade_name or "Dados da Oficina"


# Ordem canônica das colunas do Kanban de OS (mesma sequência do fluxo da OS).
# "Finalizada" e "Cancelada" nascem desmarcadas -- a visão padrão do Kanban
# mostra apenas as colunas operacionais.
KANBAN_STATUS_ORDER = [
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
]
KANBAN_DEFAULT_HIDDEN = ["finished", "canceled"]


def default_kanban_columns():
    """Colunas padrão do Kanban (todas operacionais visíveis, terminais ocultas)."""
    return [
        {"status": status, "visible": status not in KANBAN_DEFAULT_HIDDEN}
        for status in KANBAN_STATUS_ORDER
    ]


class KanbanSettings(SingletonModel):
    """Configuração do Kanban de OS (registro único, pk=1).

    Controla apenas a *visibilidade* e a *ordem* das colunas -- nunca altera o
    status de nenhuma OS. OS em colunas ocultas continuam no sistema; apenas
    deixam de ser exibidas nessa visão. Persistida como uma lista ordenada de
    ``{"status": ..., "visible": bool}``.
    """

    columns = models.JSONField(default=default_kanban_columns)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Configurações do Kanban"


class OrderSettings(SingletonModel):
    """Configurações globais da Ordem de Serviço (registro único, pk=1).

    Define o prazo padrão de entrega (aplicado a novas OS) e os textos/termos
    reutilizados na geração futura de PDFs de OS, orçamento, garantia, autorização
    e entrega.
    """

    default_delivery_days = models.PositiveIntegerField(default=7)
    warranty_terms = models.TextField(blank=True, default=DEFAULT_WARRANTY_TERMS)
    quote_terms = models.TextField(blank=True, default=DEFAULT_QUOTE_TERMS)
    service_authorization_terms = models.TextField(
        blank=True, default=DEFAULT_SERVICE_AUTHORIZATION_TERMS
    )
    customer_acknowledgment_terms = models.TextField(
        blank=True, default=DEFAULT_CUSTOMER_ACKNOWLEDGMENT_TERMS
    )
    default_os_notes = models.TextField(blank=True)
    pdf_footer_text = models.TextField(blank=True, default=DEFAULT_PDF_FOOTER_TEXT)
    print_instructions = models.TextField(blank=True)
    general_conditions = models.TextField(blank=True)
    # Notifica o cliente por e-mail quando a OS chega a marcos (pronta/finalizada).
    notify_customer_by_email = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Configurações da OS"
