from rest_framework import serializers

from .models import Customer
from .utils import find_customer_conflicts, only_digits


class CustomerSerializer(serializers.ModelSerializer):
    # Declared explicitly (overriding the max_length auto-generated from the
    # model field) so masked input like "(11) 98765-4321" or
    # "00.000.000/0000-00" can reach validate_*() to be normalized to digits
    # first -- the model's real, tighter max_length still applies to the
    # normalized value once it's written back into attrs.
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    whatsapp = serializers.CharField(required=False, allow_blank=True, max_length=20)
    document = serializers.CharField(required=False, allow_blank=True, max_length=20)
    zip_code = serializers.CharField(required=False, allow_blank=True, max_length=20)

    # Populated via an annotation on CustomerViewSet.get_queryset(); falls
    # back to 0 for any code path that builds this serializer off a plain
    # (non-annotated) Customer instance, since create/update don't need it.
    vehicle_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "customer_type",
            "email",
            "phone",
            "whatsapp",
            "document",
            "zip_code",
            "street",
            "number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "country",
            "notes",
            "is_active",
            "vehicle_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def get_vehicle_count(self, obj):
        return getattr(obj, "vehicle_count", 0)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome é obrigatório.")
        return value

    def validate_phone(self, value):
        digits = only_digits(value)
        if digits and len(digits) not in (10, 11):
            raise serializers.ValidationError(
                "Telefone inválido. Informe um número com DDD (10 ou 11 dígitos)."
            )
        return digits

    def validate_whatsapp(self, value):
        digits = only_digits(value)
        if digits and len(digits) not in (10, 11):
            raise serializers.ValidationError(
                "WhatsApp inválido. Informe um número com DDD (10 ou 11 dígitos)."
            )
        return digits

    def validate_zip_code(self, value):
        digits = only_digits(value)
        if digits and len(digits) != 8:
            raise serializers.ValidationError("CEP inválido. Informe 8 dígitos.")
        return digits

    def validate_state(self, value):
        return value.strip().upper()[:2]

    def validate(self, attrs):
        if "document" in attrs:
            digits = only_digits(attrs["document"])
            if digits:
                customer_type = attrs.get(
                    "customer_type",
                    getattr(
                        self.instance, "customer_type", Customer.CustomerType.INDIVIDUAL
                    ),
                )
                expected_length = (
                    11 if customer_type == Customer.CustomerType.INDIVIDUAL else 14
                )
                if len(digits) != expected_length:
                    expected_label = (
                        "CPF (11 dígitos)"
                        if expected_length == 11
                        else "CNPJ (14 dígitos)"
                    )
                    raise serializers.ValidationError(
                        {
                            "document": (
                                f"Documento inválido para o tipo de cliente selecionado. "
                                f"Esperado: {expected_label}."
                            )
                        }
                    )
            attrs["document"] = digits

        self._validate_uniqueness(attrs)
        return attrs

    def _validate_uniqueness(self, attrs):
        """Impede dois clientes com o mesmo telefone ou documento (quando informado)."""
        instance = self.instance

        def resolved(field):
            if field in attrs:
                return attrs[field]
            return getattr(instance, field, "") if instance else ""

        conflicts = find_customer_conflicts(
            phone=resolved("phone"),
            whatsapp=resolved("whatsapp"),
            document=resolved("document"),
            exclude_pk=instance.pk if instance else None,
        )
        if not conflicts:
            return
        labels = {
            "phone": "telefone",
            "whatsapp": "WhatsApp",
            "document": "documento",
        }
        errors = {
            field: f"Já existe um cliente ({other.name}) com este {labels[field]}."
            for field, other in conflicts.items()
        }
        raise serializers.ValidationError(errors)
