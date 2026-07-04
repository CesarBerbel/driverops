from rest_framework import serializers

from .models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    # Declared explicitly (overriding the max_length auto-generated from the
    # model field) so masked input like "(11) 98765-4321" or
    # "00.000.000/0000-00" can reach validate_*() to be normalized to digits
    # first -- same pattern as apps/customers/serializers.py.
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    whatsapp = serializers.CharField(required=False, allow_blank=True, max_length=20)
    document = serializers.CharField(required=False, allow_blank=True, max_length=20)
    zip_code = serializers.CharField(required=False, allow_blank=True, max_length=20)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "trade_name",
            "supplier_type",
            "document",
            "state_registration",
            "email",
            "phone",
            "whatsapp",
            "contact_name",
            "zip_code",
            "street",
            "number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "country",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome/razão social é obrigatório.")
        return value

    def validate_trade_name(self, value):
        return value.strip()

    def validate_contact_name(self, value):
        return value.strip()

    def validate_state_registration(self, value):
        return value.strip()

    def validate_phone(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and len(digits) not in (10, 11):
            raise serializers.ValidationError(
                "Telefone inválido. Informe um número com DDD (10 ou 11 dígitos)."
            )
        return digits

    def validate_whatsapp(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and len(digits) not in (10, 11):
            raise serializers.ValidationError(
                "WhatsApp inválido. Informe um número com DDD (10 ou 11 dígitos)."
            )
        return digits

    def validate_zip_code(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and len(digits) != 8:
            raise serializers.ValidationError("CEP inválido. Informe 8 dígitos.")
        return digits

    def validate_state(self, value):
        return value.strip().upper()[:2]

    def validate(self, attrs):
        if "document" in attrs:
            digits = "".join(ch for ch in attrs["document"] if ch.isdigit())
            if digits:
                supplier_type = attrs.get(
                    "supplier_type",
                    getattr(
                        self.instance, "supplier_type", Supplier.SupplierType.COMPANY
                    ),
                )
                expected_length = (
                    11 if supplier_type == Supplier.SupplierType.INDIVIDUAL else 14
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
                                f"Documento inválido para o tipo de fornecedor selecionado. "
                                f"Esperado: {expected_label}."
                            )
                        }
                    )
            attrs["document"] = digits
        return attrs
