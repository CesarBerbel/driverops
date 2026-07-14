from django.db import models


class Vehicle(models.Model):
    class FuelType(models.TextChoices):
        GASOLINE = "gasoline", "Gasolina"
        ETHANOL = "ethanol", "Etanol"
        FLEX = "flex", "Flex"
        DIESEL = "diesel", "Diesel"
        HYBRID = "hybrid", "Híbrido"
        ELECTRIC = "electric", "Elétrico"
        CNG = "cng", "GNV"
        OTHER = "other", "Outro"

    class Transmission(models.TextChoices):
        MANUAL = "manual", "Manual"
        AUTOMATIC = "automatic", "Automático"
        AUTOMATED = "automated", "Automatizado"
        CVT = "cvt", "CVT"
        OTHER = "other", "Outro"

    class Steering(models.TextChoices):
        MECHANICAL = "mechanical", "Mecânica"
        HYDRAULIC = "hydraulic", "Hidráulica"
        ELECTRIC = "electric", "Elétrica"
        ELECTROHYDRAULIC = "electrohydraulic", "Eletro-hidráulica"
        OTHER = "other", "Outra"

    class VehicleType(models.TextChoices):
        CAR = "car", "Carro"
        MOTORCYCLE = "motorcycle", "Moto"
        PICKUP = "pickup", "Caminhonete"
        VAN = "van", "Van"
        TRUCK = "truck", "Caminhão"
        UTILITY = "utility", "Utilitário"
        OTHER = "other", "Outro"

    class UsageCategory(models.TextChoices):
        PRIVATE = "private", "Particular"
        COMMERCIAL = "commercial", "Comercial"
        RIDE_HAILING = "ride_hailing", "Aplicativo"
        TAXI = "taxi", "Táxi"
        FLEET = "fleet", "Frota"
        OTHER = "other", "Outro"

    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="vehicles"
    )
    # license_plate/chassis/renavam are always stored normalized -- see
    # VehicleSerializer's validate_* methods.
    license_plate = models.CharField(max_length=7, db_index=True)
    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    version = models.CharField(max_length=100, blank=True)
    manufacture_year = models.PositiveSmallIntegerField(null=True, blank=True)
    model_year = models.PositiveSmallIntegerField(null=True, blank=True)
    color = models.CharField(max_length=50, blank=True)
    mileage = models.PositiveIntegerField(null=True, blank=True)
    fuel_type = models.CharField(max_length=20, choices=FuelType.choices, blank=True)
    transmission = models.CharField(
        max_length=20, choices=Transmission.choices, blank=True
    )
    steering = models.CharField(max_length=20, choices=Steering.choices, blank=True)
    # 2/3/4/5 doors; null means "não informado".
    doors = models.PositiveSmallIntegerField(null=True, blank=True)
    # Tri-state: True/False/None ("não informado").
    air_conditioning = models.BooleanField(null=True, blank=True)
    is_modified = models.BooleanField(null=True, blank=True)
    modification_notes = models.TextField(blank=True)
    vehicle_type = models.CharField(
        max_length=20, choices=VehicleType.choices, blank=True
    )
    usage_category = models.CharField(
        max_length=20, choices=UsageCategory.choices, blank=True
    )
    chassis = models.CharField(max_length=30, blank=True)
    renavam = models.CharField(max_length=20, blank=True)
    fipe_code = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    # Internal soft-delete flag. Never rendered as a field in the UI -- same
    # rule as Category.is_active.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["license_plate"]

    def __str__(self):
        return self.license_plate

    @classmethod
    def has_active_plate_conflict(cls, license_plate, exclude_pk=None):
        conflict = cls.objects.filter(is_active=True, license_plate=license_plate)
        if exclude_pk is not None:
            conflict = conflict.exclude(pk=exclude_pk)
        return conflict.exists()


class VehicleBrand(models.Model):
    """Tabela auxiliar (oculta) de marcas de carros conhecidas/comercializadas no
    Brasil, usada apenas para autocompletar o campo "Marca" do veículo. NÃO
    restringe o cadastro: a marca do veículo continua sendo texto livre -- estas
    são só sugestões. Não tem tela de gestão; é populada por migração de dados.
    """

    name = models.CharField(max_length=60, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
