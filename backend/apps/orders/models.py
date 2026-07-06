from django.db import models
from django.db.models import Max


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
        max_length=20, choices=Status.choices, default=Status.OPEN
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
    is_active = models.BooleanField(default=True)
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
            last = WorkOrder.objects.aggregate(m=Max("number"))["m"] or 0
            self.number = last + 1
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
