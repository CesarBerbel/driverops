from rest_framework import serializers

from apps.workshop.models import OrderSettings, WorkshopProfile

from .calc import compute_totals, item_subtotal
from .models import Quote, QuoteItem


class QuoteItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.SerializerMethodField()
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = QuoteItem
        fields = [
            "id",
            "kind",
            "kind_display",
            "description",
            "quantity",
            "unit_price",
            "subtotal",
            "is_custom",
            "notes",
            "status",
            "status_display",
            "linked_service",
        ]

    def get_subtotal(self, obj):
        return str(item_subtotal(obj))


class _QuoteTotalsMixin:
    """Serializa os totais do orçamento (calculados em ``calc.compute_totals``)."""

    def totals(self, obj):
        return {key: str(value) for key, value in compute_totals(obj).items()}


class QuoteSerializer(_QuoteTotalsMixin, serializers.ModelSerializer):
    """Orçamento para as telas internas (autenticadas)."""

    items = QuoteItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    channel_display = serializers.CharField(
        source="get_approval_channel_display", read_only=True
    )
    work_order_number = serializers.IntegerField(
        source="work_order.number", read_only=True
    )
    customer_name = serializers.CharField(
        source="work_order.customer.name", read_only=True
    )
    customer_email = serializers.CharField(
        source="work_order.customer.email", read_only=True
    )
    vehicle_plate = serializers.CharField(
        source="work_order.vehicle.license_plate", read_only=True
    )
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=""
    )
    approved_by_name = serializers.CharField(
        source="approved_by.full_name", read_only=True, default=""
    )
    signature_image = serializers.FileField(read_only=True)
    signed_document = serializers.FileField(read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            "id",
            "number",
            "version",
            "status",
            "status_display",
            "work_order",
            "work_order_number",
            "customer_name",
            "customer_email",
            "vehicle_plate",
            "customer_report",
            "diagnosis",
            "discount_type",
            "discount_value",
            "valid_until",
            "public_token",
            "items",
            "totals",
            "created_by_name",
            "created_at",
            "sent_at",
            "sent_to_email",
            "viewed_at",
            "decided_at",
            "approval_channel",
            "channel_display",
            "approved_by_name",
            "client_name",
            "terms_accepted",
            "rejection_reason",
            "approval_note",
            "decision_ip",
            "decision_user_agent",
            "signature_image",
            "signed_document",
        ]
        read_only_fields = fields

    def get_totals(self, obj):
        return self.totals(obj)


class PublicQuoteSerializer(_QuoteTotalsMixin, serializers.ModelSerializer):
    """Subconjunto seguro exposto na página pública de aprovação.

    Só os dados necessários daquele orçamento -- nada de e-mails de usuários
    internos, tokens de outros orçamentos ou IDs sensíveis.
    """

    items = QuoteItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    workshop = serializers.SerializerMethodField()
    terms = serializers.SerializerMethodField()
    work_order_number = serializers.IntegerField(
        source="work_order.number", read_only=True
    )
    customer_name = serializers.CharField(
        source="work_order.customer.name", read_only=True
    )
    vehicle_plate = serializers.CharField(
        source="work_order.vehicle.license_plate", read_only=True
    )
    vehicle_description = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()
    can_decide = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = [
            "number",
            "version",
            "status",
            "status_display",
            "can_decide",
            "work_order_number",
            "customer_name",
            "vehicle_plate",
            "vehicle_description",
            "customer_report",
            "diagnosis",
            "valid_until",
            "discount_type",
            "items",
            "totals",
            "client_name",
            "decided_at",
            "rejection_reason",
            "workshop",
            "terms",
        ]

    def get_totals(self, obj):
        return self.totals(obj)

    def get_can_decide(self, obj):
        return obj.status in Quote.DECIDABLE_STATUSES

    def get_vehicle_description(self, obj):
        vehicle = obj.work_order.vehicle
        return " ".join(p for p in [vehicle.brand, vehicle.model] if p).strip()

    def get_workshop(self, obj):
        profile = WorkshopProfile.get_solo()
        request = self.context.get("request")
        logo = None
        if profile.logo:
            logo = profile.logo.url
            if request is not None:
                logo = request.build_absolute_uri(logo)
        return {
            "trade_name": profile.trade_name,
            "legal_name": profile.legal_name,
            "cnpj": profile.cnpj,
            "phone": profile.phone,
            "whatsapp": profile.whatsapp,
            "email": profile.email,
            "city": profile.city,
            "state": profile.state,
            "logo": logo,
        }

    def get_terms(self, obj):
        os_settings = OrderSettings.get_solo()
        return {
            "quote_terms": os_settings.quote_terms,
            "warranty_terms": os_settings.warranty_terms,
            "service_authorization_terms": os_settings.service_authorization_terms,
        }
