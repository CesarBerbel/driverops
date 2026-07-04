from rest_framework import serializers

from apps.customers.utils import only_digits

from .models import OrderSettings, WorkshopProfile


class WorkshopProfileSerializer(serializers.ModelSerializer):
    # Declared explicitly (wider max_length) so masked input like
    # "00.000.000/0000-00" or "(11) 98765-4321" reaches validate_*() to be
    # normalized to digits first -- same idiom as CustomerSerializer.
    cnpj = serializers.CharField(required=False, allow_blank=True, max_length=20)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    whatsapp = serializers.CharField(required=False, allow_blank=True, max_length=20)
    zip_code = serializers.CharField(required=False, allow_blank=True, max_length=20)
    # The logo is uploaded/removed through the dedicated logo endpoint, so it is
    # read-only here (a plain JSON PATCH of the other fields never touches it).
    logo = serializers.FileField(read_only=True)

    class Meta:
        model = WorkshopProfile
        fields = [
            "trade_name",
            "legal_name",
            "cnpj",
            "state_registration",
            "responsible",
            "email",
            "phone",
            "whatsapp",
            "website",
            "logo",
            "zip_code",
            "street",
            "number",
            "complement",
            "neighborhood",
            "city",
            "state",
            "country",
            "notes",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_trade_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome fantasia é obrigatório.")
        return value

    def validate_cnpj(self, value):
        digits = only_digits(value)
        if digits and len(digits) != 14:
            raise serializers.ValidationError("CNPJ inválido. Informe 14 dígitos.")
        return digits

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


class OrderSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderSettings
        fields = [
            "default_delivery_days",
            "warranty_terms",
            "quote_terms",
            "service_authorization_terms",
            "customer_acknowledgment_terms",
            "default_os_notes",
            "pdf_footer_text",
            "print_instructions",
            "general_conditions",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_default_delivery_days(self, value):
        # PositiveIntegerField already blocks negatives at the DB level; guard
        # here too so the API returns a clear message instead of a 500. Zero is
        # allowed (same-day delivery).
        if value is None or value < 0:
            raise serializers.ValidationError(
                "O prazo padrão de entrega não pode ser negativo."
            )
        return value
