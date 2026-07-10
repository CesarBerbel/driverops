from rest_framework import serializers

from .models import (
    CrmCampaign,
    CrmSettings,
    CrmSuggestion,
    CrmSuggestionEvent,
    CrmTask,
)


def _name(user):
    return (user.full_name or user.email) if user else None


class SuggestionEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CrmSuggestionEvent
        fields = [
            "id",
            "description",
            "from_status",
            "to_status",
            "actor_name",
            "created_at",
        ]

    def get_actor_name(self, obj):
        return _name(obj.actor)


class SuggestionSerializer(serializers.ModelSerializer):
    suggestion_type_display = serializers.CharField(
        source="get_suggestion_type_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    channel_display = serializers.CharField(
        source="get_channel_display", read_only=True
    )
    customer_name = serializers.CharField(
        source="customer.name", read_only=True, default=None
    )
    customer_phone = serializers.CharField(
        source="customer.phone", read_only=True, default=""
    )
    customer_whatsapp = serializers.CharField(
        source="customer.whatsapp", read_only=True, default=""
    )
    customer_email = serializers.CharField(
        source="customer.email", read_only=True, default=""
    )
    vehicle_plate = serializers.CharField(
        source="vehicle.license_plate", read_only=True, default=""
    )
    work_order_number = serializers.IntegerField(
        source="work_order.number", read_only=True, default=None
    )
    quote_number = serializers.IntegerField(
        source="quote.number", read_only=True, default=None
    )
    assigned_to_name = serializers.SerializerMethodField()
    events = SuggestionEventSerializer(many=True, read_only=True)

    class Meta:
        model = CrmSuggestion
        fields = [
            "id",
            "suggestion_type",
            "suggestion_type_display",
            "category",
            "category_display",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "reason",
            "recommended_action",
            "suggested_text",
            "channel",
            "channel_display",
            "due_date",
            "snoozed_until",
            "source",
            "customer",
            "customer_name",
            "customer_phone",
            "customer_whatsapp",
            "customer_email",
            "vehicle_plate",
            "work_order",
            "work_order_number",
            "quote",
            "quote_number",
            "lead",
            "assigned_to",
            "assigned_to_name",
            "events",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        # Só texto/prioridade/canal/responsável/prazo são graváveis por PATCH.
        read_only_fields = [
            f
            for f in fields
            if f
            not in {"suggested_text", "priority", "channel", "assigned_to", "due_date"}
        ]

    def get_assigned_to_name(self, obj):
        return _name(obj.assigned_to)


class TaskSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source="customer.name", read_only=True, default=None
    )
    customer_phone = serializers.CharField(
        source="customer.phone", read_only=True, default=""
    )
    customer_whatsapp = serializers.CharField(
        source="customer.whatsapp", read_only=True, default=""
    )
    vehicle_plate = serializers.CharField(
        source="vehicle.license_plate", read_only=True, default=""
    )
    work_order_number = serializers.IntegerField(
        source="work_order.number", read_only=True, default=None
    )
    quote_number = serializers.IntegerField(
        source="quote.number", read_only=True, default=None
    )
    assigned_to_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(
        source="get_priority_display", read_only=True
    )

    class Meta:
        model = CrmTask
        fields = [
            "id",
            "title",
            "customer",
            "customer_name",
            "customer_phone",
            "customer_whatsapp",
            "vehicle",
            "vehicle_plate",
            "work_order",
            "work_order_number",
            "quote",
            "quote_number",
            "suggestion",
            "assigned_to",
            "assigned_to_name",
            "due_date",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_assigned_to_name(self, obj):
        return _name(obj.assigned_to)


class CampaignSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CrmCampaign
        fields = [
            "id",
            "name",
            "segment_key",
            "channel",
            "message",
            "status",
            "status_display",
            "audience_count",
            "created_at",
        ]
        read_only_fields = ["id", "status", "status_display", "created_at"]


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmSettings
        exclude = ["id", "updated_by"]
        read_only_fields = ["updated_at"]
