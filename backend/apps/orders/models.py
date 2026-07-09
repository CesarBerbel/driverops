from django.conf import settings
from django.db import models, transaction

from apps.core.locks import assign_next_number


class WorkOrder(models.Model):
    """Ordem de Serviço (OS) -- o documento central da oficina.

    Vincula um veículo e o cliente dono do veículo, agrupa itens (serviços,
    pacotes e peças, cadastrados ou avulsos) e mantém o histórico do
    atendimento. Os totais são calculados no serializer (fonte da verdade no
    backend), nunca persistidos.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Aberta"
        DIAGNOSING = "diagnosing", "Em diagnóstico"
        AWAITING_APPROVAL = "awaiting_approval", "Aguardando aprovação"
        APPROVED = "approved", "Aprovada"
        IN_PROGRESS = "in_progress", "Em execução"
        AWAITING_PARTS = "awaiting_parts", "Aguardando peças"
        TESTING = "testing", "Em teste"
        READY = "ready", "Pronta para entrega"
        FINISHED = "finished", "Finalizada"
        CANCELED = "canceled", "Cancelada"

    class DiscountType(models.TextChoices):
        NONE = "none", "Nenhum"
        PERCENT = "percent", "Percentual"
        FIXED = "fixed", "Valor fixo"

    # Sequential, human-facing OS number. Assigned on first save (see save()),
    # never edited afterwards.
    number = models.PositiveIntegerField(unique=True, editable=False)
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="work_orders"
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle", on_delete=models.PROTECT, related_name="work_orders"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    # Técnico responsável pela OS. Opcional; atribuído/trocado a qualquer momento.
    # SET_NULL para nunca apagar a OS ao desativar/excluir um usuário.
    assigned_technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_orders",
        null=True,
        blank=True,
    )
    opened_at = models.DateField()
    expected_delivery = models.DateField(null=True, blank=True)
    current_mileage = models.PositiveIntegerField(null=True, blank=True)
    customer_report = models.TextField()
    diagnosis = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.NONE
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Internal soft-delete flag. Never rendered as a field in the UI -- same
    # rule as Vehicle.is_active. "Excluir" na interface apenas desabilita.
    is_active = models.BooleanField(default=True, db_index=True)
    # Marca se a baixa automática de estoque (peças cadastradas da OS) já foi
    # feita ao finalizar. Garante idempotência: finalizar de novo (ou reabrir e
    # finalizar) não dá baixa em dobro. Ver apps/orders/stock.py.
    stock_deducted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-number"]

    def __str__(self):
        return f"OS #{self.number}"

    def save(self, *args, **kwargs):
        if not self.number:
            with transaction.atomic():
                assign_next_number(self, lock_name="orders.workorder.number")
                super().save(*args, **kwargs)
            return
        super().save(*args, **kwargs)


class WorkOrderService(models.Model):
    """Linha de serviço da OS.

    `service` nulo indica um item *avulso* (nome livre em `description`), usado
    só nesta OS e nunca gravado no catálogo. `description` e `unit_price` são
    congelados (snapshot) no momento da OS para preservar o histórico mesmo que
    o serviço cadastrado seja alterado ou desabilitado depois.
    """

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="service_items"
    )
    service = models.ForeignKey(
        "services.Service",
        on_delete=models.PROTECT,
        related_name="work_order_links",
        null=True,
        blank=True,
    )
    description = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.description or (self.service.name if self.service else "Serviço")


class WorkOrderPackage(models.Model):
    """Linha de pacote da OS. `package` nulo => pacote avulso."""

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="package_items"
    )
    package = models.ForeignKey(
        "services.ServicePackage",
        on_delete=models.PROTECT,
        related_name="work_order_links",
        null=True,
        blank=True,
    )
    description = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.description or (self.package.name if self.package else "Pacote")


class WorkOrderPart(models.Model):
    """Linha de peça da OS. `part` nulo => peça avulsa.

    A baixa de estoque NÃO é feita nesta fase (limitação conhecida) -- o
    vínculo com a peça cadastrada já existe para permitir essa evolução futura
    sem refatoração.
    """

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="part_items"
    )
    part = models.ForeignKey(
        "parts.Part",
        on_delete=models.PROTECT,
        related_name="work_order_links",
        null=True,
        blank=True,
    )
    description = models.CharField(max_length=200, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Peça associada a um serviço da OS (cadastrado ou avulso). Usada no orçamento
    # para aprovar/recusar a peça em conjunto com o serviço. A associação é feita
    # por índice no payload (as linhas usam replace-all) -- ver o serializer.
    linked_service = models.ForeignKey(
        WorkOrderService,
        on_delete=models.SET_NULL,
        related_name="linked_parts",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.description or (self.part.name if self.part else "Peça")


class OrderStatusHistory(models.Model):
    """Linha do tempo das mudanças de status de uma OS.

    Registrada automaticamente pelo `WorkOrderViewSet` a cada troca de status
    (criação, arrastar no Kanban ou editar). Imutável -- nunca editada nem
    apagada (a não ser em cascata, se a OS for removida fisicamente, o que o
    sistema não faz: OS usa soft delete).
    """

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="status_history"
    )
    # Vazio = criação da OS (não havia status anterior).
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "order status histories"

    def __str__(self):
        return f"OS #{self.order.number}: {self.from_status or '—'} -> {self.to_status}"


def order_attachment_path(instance, filename):
    # Agrupa por OS: media/orders/<número>/<arquivo>.
    return f"orders/{instance.order_id}/{filename}"


class OrderAttachment(models.Model):
    """Arquivo anexado a uma OS (foto do veículo, laudo, nota, etc.)."""

    class Category(models.TextChoices):
        ENTRY = "entry", "Entrada do veículo"
        EXTERNAL_DAMAGE = "external_damage", "Avaria externa"
        INTERNAL_DAMAGE = "internal_damage", "Avaria interna"
        ENGINE = "engine", "Motor"
        SUSPENSION = "suspension", "Suspensão"
        BRAKES = "brakes", "Freios"
        DAMAGED_PART = "damaged_part", "Peça danificada"
        IN_PROGRESS = "in_progress", "Serviço em andamento"
        COMPLETED = "completed", "Serviço concluído"
        DELIVERY = "delivery", "Entrega do veículo"
        OTHER = "other", "Outros"

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to=order_attachment_path)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.OTHER
    )
    caption = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.original_name


class OrderEvent(models.Model):
    """Linha do tempo unificada da OS: status, fotos e ciclo do orçamento.

    Registro imutável (append-only), somente leitura na interface. Complementa o
    OrderStatusHistory (que continua guardando o de/para de status) com os demais
    eventos relevantes do atendimento.
    """

    class Type(models.TextChoices):
        CREATED = "created", "OS criada"
        STATUS_CHANGED = "status_changed", "Status alterado"
        ATTACHMENT_ADDED = "attachment_added", "Foto/anexo adicionado"
        ATTACHMENT_REMOVED = "attachment_removed", "Foto/anexo removido"
        QUOTE_CREATED = "quote_created", "Orçamento criado"
        QUOTE_SENT = "quote_sent", "Orçamento enviado"
        QUOTE_APPROVED = "quote_approved", "Orçamento aprovado"
        QUOTE_PARTIALLY_APPROVED = (
            "quote_partially_approved",
            "Orçamento aprovado parcialmente",
        )
        QUOTE_REJECTED = "quote_rejected", "Orçamento recusado"
        PAYMENT_REGISTERED = "payment_registered", "Pagamento registrado"
        PAYMENT_REMOVED = "payment_removed", "Pagamento estornado"
        CUSTOMER_NOTIFIED = "customer_notified", "Cliente notificado por e-mail"

    order = models.ForeignKey(
        WorkOrder, on_delete=models.CASCADE, related_name="events"
    )
    event_type = models.CharField(max_length=30, choices=Type.choices)
    description = models.CharField(max_length=255, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    channel = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"OS #{self.order_id}: {self.get_event_type_display()}"
