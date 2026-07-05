from django.conf import settings
from django.db import models


class Part(models.Model):
    class UnitOfMeasure(models.TextChoices):
        UNIT = "unit", "Unidade"
        PAIR = "pair", "Par"
        KIT = "kit", "Kit"
        LITER = "liter", "Litro"
        MILLILITER = "milliliter", "Mililitro"
        METER = "meter", "Metro"
        CENTIMETER = "centimeter", "Centímetro"
        BOX = "box", "Caixa"
        PACK = "pack", "Pacote"
        SET = "set", "Jogo"
        OTHER = "other", "Outro"

    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="parts"
    )
    name = models.CharField(max_length=150)
    internal_code = models.CharField(max_length=50, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    model_application = models.CharField(max_length=150, blank=True)
    unit_of_measure = models.CharField(
        max_length=20, choices=UnitOfMeasure.choices, default=UnitOfMeasure.UNIT
    )
    # Decimal (never float) -- quantities support fractional units (litros),
    # prices need exact currency math. Serialized as JSON strings by DRF.
    current_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_quantity = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    sale_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    location = models.CharField(max_length=100, blank=True)
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.PROTECT,
        related_name="parts",
        null=True,
        blank=True,
    )
    ncm = models.CharField(max_length=8, blank=True)
    barcode = models.CharField(max_length=30, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self) -> bool:
        return (
            self.min_quantity is not None and self.current_quantity <= self.min_quantity
        )


class StockMovement(models.Model):
    """Registro imutável de uma movimentação de estoque de uma peça.

    Cada linha é um fato histórico -- nunca editada nem apagada. O saldo da peça
    (`Part.current_quantity`) é a soma dos efeitos das movimentações; guardamos
    `resulting_quantity` (o saldo logo após o movimento) para auditoria e para
    exibir o extrato sem recomputar. O campo `quantity` é sempre positivo; o
    sinal/efeito é dado por `kind`:

    - entrada (`in`):   saldo += quantity
    - saída  (`out`):   saldo -= quantity
    - ajuste (`adjust`): saldo := quantity (contagem física; `quantity` é o novo
      saldo absoluto, não um delta)
    """

    class Kind(models.TextChoices):
        IN = "in", "Entrada"
        OUT = "out", "Saída"
        ADJUST = "adjust", "Ajuste"

    part = models.ForeignKey(Part, on_delete=models.PROTECT, related_name="movements")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    # Decimal (nunca float) -- mesmo motivo de Part.current_quantity.
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    resulting_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=200, blank=True)
    # Preenchido automaticamente quando a baixa vem da finalização de uma OS.
    order = models.ForeignKey(
        "orders.WorkOrder",
        on_delete=models.SET_NULL,
        related_name="stock_movements",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.get_kind_display()} de {self.quantity} ({self.part.name})"
