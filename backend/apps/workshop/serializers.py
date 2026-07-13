from rest_framework import serializers

from apps.customers.utils import only_digits

from .models import (
    KANBAN_DEFAULT_HIDDEN,
    KANBAN_STATUS_ORDER,
    KanbanSettings,
    OrderSettings,
    PdfLayoutSettings,
    WorkshopProfile,
)
from .pdf_blocks import (
    BLOCK_CATALOG,
    normalize_accent_color,
    normalize_base_font_size,
    normalize_blocks,
)


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
            "business_hours",
            "notes",
            "testimonials",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_testimonials(self, value):
        """Normaliza a lista de depoimentos (texto puro, campos e limites)."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Formato inválido.")
        cleaned = []
        for item in value[:12]:  # limite razoável de depoimentos
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()[:80]
            quote = str(item.get("quote", "")).strip()[:400]
            if not name or not quote:
                continue
            try:
                rating = int(item.get("rating", 5))
            except (TypeError, ValueError):
                rating = 5
            cleaned.append(
                {
                    "name": name,
                    "service": str(item.get("service", "")).strip()[:80],
                    "rating": min(5, max(1, rating)),
                    "quote": quote,
                }
            )
        return cleaned

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
            "default_payment_due_days",
            "warranty_terms",
            "quote_terms",
            "service_authorization_terms",
            "customer_acknowledgment_terms",
            "default_os_notes",
            "pdf_footer_text",
            "print_instructions",
            "general_conditions",
            "notify_customer_by_email",
            "notify_statuses",
            "notify_on_creation",
            "notify_on_payment",
            "require_diagnosis_before_approval",
            "require_approved_quote_for_execution",
            "require_checkin_before_execution",
            "require_payment_to_finish",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_notify_statuses(self, value):
        from apps.orders.models import WorkOrder

        valid = set(WorkOrder.Status.values)
        if not isinstance(value, list) or any(s not in valid for s in value):
            raise serializers.ValidationError("Lista de status inválida.")
        return value

    def validate_default_payment_due_days(self, value):
        if value is None or value < 0 or value > 365:
            raise serializers.ValidationError(
                "O prazo de pagamento deve estar entre 0 e 365 dias."
            )
        return value

    def validate_default_delivery_days(self, value):
        # PositiveIntegerField already blocks negatives at the DB level; guard
        # here too so the API returns a clear message instead of a 500. Zero is
        # allowed (same-day delivery).
        if value is None or value < 0:
            raise serializers.ValidationError(
                "O prazo padrão de entrega não pode ser negativo."
            )
        return value


class PdfLayoutSettingsSerializer(serializers.ModelSerializer):
    # Lista ordenada de blocos {type, options, id?}. A validação delega para
    # normalize_blocks (descarta tipos inválidos e saneia opções por tipo).
    blocks = serializers.ListField(child=serializers.DictField(), required=False)
    # Sem max_length aqui: qualquer valor inválido é saneado por normalize_accent_color
    # (que sempre devolve um hex curto), em vez de estourar um 400.
    accent_color = serializers.CharField(required=False, allow_blank=True)
    base_font_size = serializers.FloatField(required=False)
    # Catálogo de blocos disponíveis (somente leitura), para o editor montar a UI.
    catalog = serializers.SerializerMethodField()

    class Meta:
        model = PdfLayoutSettings
        fields = ["blocks", "accent_color", "base_font_size", "catalog", "updated_at"]
        read_only_fields = ["catalog", "updated_at"]

    def get_catalog(self, obj):
        return BLOCK_CATALOG

    def validate_blocks(self, value):
        return normalize_blocks(value)

    def validate_accent_color(self, value):
        return normalize_accent_color(value)

    def validate_base_font_size(self, value):
        return normalize_base_font_size(value)


class KanbanSettingsSerializer(serializers.ModelSerializer):
    # Ordered list of {"status": <os status>, "visible": bool}. Reordering the
    # list reorders the Kanban columns.
    columns = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = KanbanSettings
        fields = ["columns", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_columns(self, value):
        seen = []
        normalized = []
        for item in value:
            status = item.get("status")
            if status not in KANBAN_STATUS_ORDER:
                raise serializers.ValidationError(f"Status inválido: {status!r}.")
            if status in seen:
                raise serializers.ValidationError(f"Status duplicado: {status!r}.")
            seen.append(status)
            normalized.append(
                {"status": status, "visible": bool(item.get("visible", True))}
            )
        # Ensure every known status is present so the config is always complete;
        # missing ones are appended in canonical order with their default state.
        for status in KANBAN_STATUS_ORDER:
            if status not in seen:
                normalized.append(
                    {"status": status, "visible": status not in KANBAN_DEFAULT_HIDDEN}
                )
        return normalized
