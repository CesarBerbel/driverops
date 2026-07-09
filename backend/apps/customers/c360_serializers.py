from rest_framework import serializers

from .models import CustomerInteraction


def _user_name(user):
    return (user.full_name or user.email) if user else None


class InteractionSerializer(serializers.ModelSerializer):
    interaction_type_display = serializers.CharField(
        source="get_interaction_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    vehicle_plate = serializers.CharField(
        source="vehicle.license_plate", read_only=True, default=""
    )
    work_order_number = serializers.IntegerField(
        source="work_order.number", read_only=True, default=None
    )
    quote_number = serializers.IntegerField(
        source="quote.number", read_only=True, default=None
    )

    class Meta:
        model = CustomerInteraction
        fields = [
            "id",
            "interaction_type",
            "interaction_type_display",
            "channel",
            "title",
            "summary",
            "content",
            "status",
            "status_display",
            "next_action",
            "next_action_date",
            "vehicle",
            "vehicle_plate",
            "work_order",
            "work_order_number",
            "quote",
            "quote_number",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def validate_summary(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Informe um resumo da interação.")
        return value
