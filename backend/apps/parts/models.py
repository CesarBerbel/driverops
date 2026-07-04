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
    # Free text for now -- no Supplier model exists yet; ready to become a FK later.
    supplier = models.CharField(max_length=150, blank=True)
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
