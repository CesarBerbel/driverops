"""Check-in de entrada do veículo (estado visual + itens no recebimento).

Registra avarias marcadas num mapa do carro, fotos, checklist de itens,
objetos deixados pelo cliente e observações gerais -- um histórico auditável do
estado do veículo na entrada. Não substitui o diagnóstico técnico.
"""

from django.conf import settings
from django.db import models


def damage_photo_path(instance, filename):
    return f"checkin/{instance.damage.check_in.order_id}/damages/{filename}"


def checkin_photo_path(instance, filename):
    return f"checkin/{instance.check_in.order_id}/photos/{filename}"


def belonging_photo_path(instance, filename):
    return f"checkin/{instance.check_in.order_id}/belongings/{filename}"


class CheckInStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "Em andamento"
    COMPLETED = "completed", "Concluído"
    REVIEWED = "reviewed", "Revisado"


class FuelLevel(models.TextChoices):
    NOT_CHECKED = "not_checked", "Não verificado"
    RESERVE = "reserve", "Reserva"
    QUARTER = "quarter", "1/4"
    HALF = "half", "1/2"
    THREE_QUARTERS = "three_quarters", "3/4"
    FULL = "full", "Cheio"


class YesNoUnknown(models.TextChoices):
    YES = "yes", "Sim"
    NO = "no", "Não"
    NOT_VERIFIED = "not_verified", "Não verificado"


class Severity(models.TextChoices):
    LIGHT = "light", "Leve"
    MEDIUM = "medium", "Média"
    SEVERE = "severe", "Grave"


class VehicleRegion(models.TextChoices):
    FRONT = "front", "Frente"
    HOOD = "hood", "Capô"
    WINDSHIELD = "windshield", "Para-brisa"
    ROOF = "roof", "Teto"
    FRONT_LEFT_DOOR = "front_left_door", "Porta dianteira esquerda"
    REAR_LEFT_DOOR = "rear_left_door", "Porta traseira esquerda"
    LEFT_SIDE = "left_side", "Lateral esquerda"
    FRONT_RIGHT_DOOR = "front_right_door", "Porta dianteira direita"
    REAR_RIGHT_DOOR = "rear_right_door", "Porta traseira direita"
    RIGHT_SIDE = "right_side", "Lateral direita"
    TRUNK = "trunk", "Porta-malas"
    FRONT_BUMPER = "front_bumper", "Para-choque dianteiro"
    REAR_BUMPER = "rear_bumper", "Para-choque traseiro"
    WHEELS = "wheels", "Rodas"
    MIRRORS = "mirrors", "Retrovisores"
    HEADLIGHTS = "headlights", "Faróis"
    TAILLIGHTS = "taillights", "Lanternas"
    INTERIOR = "interior", "Interior"
    OTHER = "other", "Outro"


class DamageType(models.TextChoices):
    SCRATCH = "scratch", "Risco"
    DENT = "dent", "Amassado"
    BROKEN = "broken", "Quebrado"
    CRACKED = "cracked", "Trincado"
    MISSING_PART = "missing_part", "Peça faltando"
    PAINT = "paint", "Pintura danificada"
    GLASS = "glass", "Vidro danificado"
    LIGHT = "light", "Farol/lanterna danificado"
    TIRE = "tire", "Pneu/roda danificado"
    MIRROR = "mirror", "Retrovisor danificado"
    INTERIOR = "interior", "Interior danificado"
    STAIN = "stain", "Sujeira/mancha"
    OTHER = "other", "Outro"


class PhotoCategory(models.TextChoices):
    FRONT = "front", "Frente"
    REAR = "rear", "Traseira"
    LEFT = "left", "Lateral esquerda"
    RIGHT = "right", "Lateral direita"
    INTERIOR = "interior", "Interior"
    DASHBOARD = "dashboard", "Painel"
    TRUNK = "trunk", "Porta-malas"
    ENGINE = "engine", "Motor"
    ODOMETER = "odometer", "Quilometragem/painel"
    DOCUMENT = "document", "Documento/placa"
    OTHER = "other", "Outras"


class ItemStatus(models.TextChoices):
    PRESENT = "present", "Presente"
    ABSENT = "absent", "Ausente"
    NA = "na", "Não se aplica"
    UNCHECKED = "unchecked", "Não verificado"


# Checklist padrão criado com o check-in.
DEFAULT_CHECKLIST_ITEMS = [
    "Chave principal",
    "Chave reserva",
    "Documento do veículo",
    "Manual do proprietário",
    "Estepe",
    "Macaco",
    "Chave de roda",
    "Triângulo",
    "Tapetes",
    "Rádio/multimídia",
    "Antena",
    "Tampa do combustível",
    "Calotas",
    "Ferramentas",
    "Controle de alarme",
]


class VehicleCheckIn(models.Model):
    """Check-in de entrada de uma OS (um por OS)."""

    order = models.OneToOneField(
        "orders.WorkOrder", on_delete=models.CASCADE, related_name="check_in"
    )
    status = models.CharField(
        max_length=20, choices=CheckInStatus.choices, default=CheckInStatus.IN_PROGRESS
    )
    mileage = models.PositiveIntegerField(null=True, blank=True)
    fuel_level = models.CharField(
        max_length=20, choices=FuelLevel.choices, default=FuelLevel.NOT_CHECKED
    )
    external_condition = models.CharField(max_length=200, blank=True)
    internal_condition = models.CharField(max_length=200, blank=True)
    general_notes = models.TextField(blank=True)

    arrived_driving = models.BooleanField(default=True)
    arrived_towed = models.BooleanField(default=False)
    customer_present = models.BooleanField(default=False)
    customer_confirmed = models.BooleanField(default=False)

    belongings_status = models.CharField(
        max_length=20, choices=YesNoUnknown.choices, default=YesNoUnknown.NOT_VERIFIED
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Check-in OS #{self.order_id}"

    @property
    def is_locked(self):
        """Concluído/revisado => edição direta bloqueada (só reabrindo)."""
        return self.status in (CheckInStatus.COMPLETED, CheckInStatus.REVIEWED)


class VehicleDamage(models.Model):
    """Avaria marcada no mapa do veículo."""

    check_in = models.ForeignKey(
        VehicleCheckIn, on_delete=models.CASCADE, related_name="damages"
    )
    # Coordenadas relativas ao desenho (0..100%), para reposicionar em qualquer tela.
    x = models.DecimalField(max_digits=5, decimal_places=2)
    y = models.DecimalField(max_digits=5, decimal_places=2)
    sequence = models.PositiveIntegerField(default=1)
    region = models.CharField(
        max_length=24, choices=VehicleRegion.choices, default=VehicleRegion.OTHER
    )
    damage_type = models.CharField(
        max_length=20, choices=DamageType.choices, default=DamageType.OTHER
    )
    severity = models.CharField(
        max_length=10, choices=Severity.choices, default=Severity.LIGHT
    )
    description = models.CharField(max_length=300)
    internal_notes = models.TextField(blank=True)
    visible_to_customer = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "id"]

    def __str__(self):
        return f"Avaria #{self.sequence} ({self.get_severity_display()})"


class VehicleDamagePhoto(models.Model):
    damage = models.ForeignKey(
        VehicleDamage, on_delete=models.CASCADE, related_name="photos"
    )
    file = models.FileField(upload_to=damage_photo_path)
    caption = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class VehicleCheckInPhoto(models.Model):
    """Foto geral do veículo (por categoria), distinta das fotos de avaria."""

    check_in = models.ForeignKey(
        VehicleCheckIn, on_delete=models.CASCADE, related_name="photos"
    )
    category = models.CharField(
        max_length=20, choices=PhotoCategory.choices, default=PhotoCategory.OTHER
    )
    file = models.FileField(upload_to=checkin_photo_path)
    caption = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class VehicleCheckInItem(models.Model):
    """Item do checklist do veículo (presente/ausente/na/não verificado)."""

    check_in = models.ForeignKey(
        VehicleCheckIn, on_delete=models.CASCADE, related_name="items"
    )
    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=12, choices=ItemStatus.choices, default=ItemStatus.UNCHECKED
    )
    notes = models.CharField(max_length=200, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]


class VehicleCheckInBelonging(models.Model):
    """Objeto deixado pelo cliente dentro do veículo."""

    check_in = models.ForeignKey(
        VehicleCheckIn, on_delete=models.CASCADE, related_name="belongings"
    )
    description = models.CharField(max_length=200)
    location = models.CharField(max_length=100, blank=True)
    notes = models.CharField(max_length=200, blank=True)
    photo = models.FileField(upload_to=belonging_photo_path, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
