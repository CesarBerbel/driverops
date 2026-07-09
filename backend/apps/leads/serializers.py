from django.db.models import Q
from rest_framework import serializers

from apps.customers.models import Customer
from apps.customers.utils import only_digits
from apps.orders.status_groups import OPERATIONAL_STATUSES
from apps.vehicles.models import Vehicle

from .matching import analyze_lead, normalize_plate
from .models import LeadEvent, LeadSettings, SiteLead


class PublicLeadCreateSerializer(serializers.ModelSerializer):
    # Honeypot invisível: bots preenchem; humanos deixam vazio.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)
    # Declarados com max_length maior para que entrada mascarada
    # ("(11) 99999-8888", "ABC-1D23") chegue aos validate_*() e seja normalizada.
    phone = serializers.CharField(max_length=20)
    document = serializers.CharField(required=False, allow_blank=True, max_length=20)
    vehicle_plate = serializers.CharField(required=False, allow_blank=True, max_length=10)

    class Meta:
        model = SiteLead
        fields = [
            "name",
            "phone",
            "email",
            "document",
            "vehicle_plate",
            "vehicle_brand",
            "vehicle_model",
            "vehicle_year",
            "vehicle_mileage",
            "request_type",
            "best_period",
            "desired_date",
            "message",
            "consent",
            "website",
        ]

    def validate_website(self, value):
        if value:
            # Honeypot preenchido -> trata como spam.
            raise serializers.ValidationError("Pedido inválido.")
        return value

    def validate_name(self, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError("Informe o seu nome.")
        return value

    def validate_phone(self, value):
        digits = only_digits(value)
        if len(digits) < 10 or len(digits) > 11:
            raise serializers.ValidationError("Informe um telefone válido com DDD.")
        return digits

    def validate_document(self, value):
        return only_digits(value)

    def validate_vehicle_plate(self, value):
        return normalize_plate(value)

    def validate(self, attrs):
        conf = LeadSettings.get_solo()
        if conf.email_required and not (attrs.get("email") or "").strip():
            raise serializers.ValidationError({"email": "O e-mail é obrigatório."})
        if conf.require_consent and not attrs.get("consent"):
            raise serializers.ValidationError(
                {"consent": "É necessário autorizar o contato."}
            )
        if not conf.allow_without_vehicle:
            if conf.plate_required and not attrs.get("vehicle_plate"):
                raise serializers.ValidationError(
                    {"vehicle_plate": "Informe a placa do veículo."}
                )
        return attrs


class LeadSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadSettings
        fields = [
            "is_active",
            "email_required",
            "plate_required",
            "allow_without_vehicle",
            "require_consent",
            "sla_hours",
            "auto_reply_enabled",
            "notify_email",
            "allow_create_os",
            "allow_create_appointment",
            "require_review_on_divergence",
            "block_conversion_when_vehicle_other_customer",
            "updated_at",
            "updated_by_name",
        ]
        read_only_fields = ["updated_at"]

    def get_updated_by_name(self, obj):
        if obj.updated_by_id is None:
            return None
        return obj.updated_by.full_name or obj.updated_by.email


class LeadIndicatorsMixin(serializers.Serializer):
    indicators = serializers.SerializerMethodField()

    def get_indicators(self, obj):
        customer_existing = bool(
            obj.phone
            and Customer.objects.filter(
                Q(phone=obj.phone) | Q(whatsapp=obj.phone)
            ).exists()
        )
        vehicle = None
        if obj.vehicle_plate:
            vehicle = (
                Vehicle.objects.select_related("customer")
                .filter(license_plate=obj.vehicle_plate)
                .first()
            )
        vehicle_existing = vehicle is not None
        vehicle_divergent = False
        has_open_os = False
        if vehicle is not None:
            ref = obj.linked_customer_id
            if ref is None and customer_existing:
                ref = (
                    Customer.objects.filter(Q(phone=obj.phone) | Q(whatsapp=obj.phone))
                    .values_list("id", flat=True)
                    .first()
                )
            vehicle_divergent = ref is not None and vehicle.customer_id != ref
            has_open_os = vehicle.work_orders.filter(
                status__in=OPERATIONAL_STATUSES
            ).exists()
        return {
            "customer_existing": customer_existing,
            "vehicle_existing": vehicle_existing,
            "vehicle_divergent": vehicle_divergent,
            "has_open_os": has_open_os,
        }


class LeadListSerializer(LeadIndicatorsMixin, serializers.ModelSerializer):
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    best_period_display = serializers.CharField(source="get_best_period_display", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = SiteLead
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "vehicle_plate",
            "vehicle_brand",
            "vehicle_model",
            "vehicle_year",
            "request_type",
            "request_type_display",
            "best_period",
            "best_period_display",
            "desired_date",
            "status",
            "status_display",
            "assigned_to",
            "assigned_to_name",
            "created_at",
            "indicators",
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to_id is None:
            return None
        return obj.assigned_to.full_name or obj.assigned_to.email


class LeadEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadEvent
        fields = [
            "id",
            "event_type",
            "event_type_display",
            "description",
            "from_status",
            "to_status",
            "actor_name",
            "created_at",
        ]

    def get_actor_name(self, obj):
        if obj.actor_id is None:
            return None
        return obj.actor.full_name or obj.actor.email


class LeadDetailSerializer(LeadListSerializer):
    message = serializers.CharField(read_only=True)
    document = serializers.CharField(read_only=True)
    vehicle_mileage = serializers.IntegerField(read_only=True)
    consent = serializers.BooleanField(read_only=True)
    source = serializers.CharField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    linked_customer = serializers.SerializerMethodField()
    linked_vehicle = serializers.SerializerMethodField()
    work_order = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()
    events = LeadEventSerializer(many=True, read_only=True)

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + [
            "message",
            "document",
            "vehicle_mileage",
            "consent",
            "source",
            "updated_at",
            "linked_customer",
            "linked_vehicle",
            "work_order",
            "analysis",
            "events",
        ]

    def get_linked_customer(self, obj):
        if obj.linked_customer_id is None:
            return None
        c = obj.linked_customer
        return {"id": c.id, "name": c.name, "phone": c.phone, "whatsapp": c.whatsapp}

    def get_linked_vehicle(self, obj):
        if obj.linked_vehicle_id is None:
            return None
        v = obj.linked_vehicle
        return {
            "id": v.id,
            "license_plate": v.license_plate,
            "brand": v.brand,
            "model": v.model,
            "customer_id": v.customer_id,
        }

    def get_work_order(self, obj):
        if obj.work_order_id is None:
            return None
        return {"id": obj.work_order_id, "number": obj.work_order.number}

    def get_analysis(self, obj):
        return analyze_lead(obj)
