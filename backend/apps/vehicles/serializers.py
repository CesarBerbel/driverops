import datetime
import re

from rest_framework import serializers

from apps.customers.utils import only_digits

from .models import Vehicle

DUPLICATE_PLATE_MESSAGE = "Já existe um veículo ativo com esta placa."

OLD_PLATE_RE = re.compile(r"^[A-Z]{3}[0-9]{4}$")
MERCOSUL_PLATE_RE = re.compile(r"^[A-Z]{3}[0-9][A-Z][0-9]{2}$")

MIN_YEAR = 1900


def _current_max_year() -> int:
    return datetime.date.today().year + 2


class VehicleSerializer(serializers.ModelSerializer):
    # Declared explicitly (overriding the max_length auto-generated from the
    # model field) so input with separators/lowercase can reach validate_*()
    # to be normalized first -- see the identical pattern in
    # apps/customers/serializers.py for phone/document/zip_code.
    license_plate = serializers.CharField(max_length=20)
    chassis = serializers.CharField(required=False, allow_blank=True, max_length=40)
    renavam = serializers.CharField(required=False, allow_blank=True, max_length=30)

    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_whatsapp = serializers.CharField(
        source="customer.whatsapp", read_only=True
    )

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "customer",
            "customer_name",
            "customer_whatsapp",
            "license_plate",
            "brand",
            "model",
            "version",
            "manufacture_year",
            "model_year",
            "color",
            "mileage",
            "fuel_type",
            "transmission",
            "steering",
            "doors",
            "air_conditioning",
            "is_modified",
            "modification_notes",
            "vehicle_type",
            "usage_category",
            "chassis",
            "renavam",
            "fipe_code",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_license_plate(self, value):
        plate = value.upper().replace(" ", "").replace("-", "")
        if not plate:
            raise serializers.ValidationError("A placa é obrigatória.")
        if not (OLD_PLATE_RE.match(plate) or MERCOSUL_PLATE_RE.match(plate)):
            raise serializers.ValidationError(
                "Placa inválida. Use o padrão antigo (ABC1234) ou Mercosul (ABC1D23)."
            )
        return plate

    def validate_chassis(self, value):
        return value.upper().strip()

    def validate_renavam(self, value):
        return only_digits(value)

    def validate_brand(self, value):
        return value.strip()

    def validate_model(self, value):
        return value.strip()

    def validate_version(self, value):
        return value.strip()

    def validate_color(self, value):
        return value.strip()

    def validate_fipe_code(self, value):
        return value.strip()

    def validate_doors(self, value):
        if value is not None and value not in (2, 3, 4, 5):
            raise serializers.ValidationError("Quantidade de portas inválida.")
        return value

    def validate_mileage(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("A quilometragem não pode ser negativa.")
        return value

    def _validate_year(self, value, field_label):
        if value is not None and not (MIN_YEAR <= value <= _current_max_year()):
            raise serializers.ValidationError(
                f"{field_label} inválido. Informe um ano de 4 dígitos válido."
            )
        return value

    def validate_manufacture_year(self, value):
        return self._validate_year(value, "Ano de fabricação")

    def validate_model_year(self, value):
        return self._validate_year(value, "Ano do modelo")

    def validate(self, attrs):
        if "license_plate" in attrs:
            plate = attrs["license_plate"]
            exclude_pk = self.instance.pk if self.instance is not None else None
            if Vehicle.has_active_plate_conflict(plate, exclude_pk=exclude_pk):
                raise serializers.ValidationError(
                    {"license_plate": DUPLICATE_PLATE_MESSAGE}
                )

        manufacture_year = attrs.get(
            "manufacture_year", getattr(self.instance, "manufacture_year", None)
        )
        model_year = attrs.get("model_year", getattr(self.instance, "model_year", None))
        if manufacture_year is not None and model_year is not None:
            if model_year < manufacture_year:
                raise serializers.ValidationError(
                    {
                        "model_year": (
                            "O ano do modelo não pode ser anterior ao ano de fabricação."
                        )
                    }
                )
        return attrs
