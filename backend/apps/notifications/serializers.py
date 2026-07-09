from rest_framework import serializers

from .models import NotificationLog, NotificationTemplate
from .rendering import validate_template_fields


class NotificationTemplateSerializer(serializers.ModelSerializer):
    event_display = serializers.CharField(source="get_event_display", read_only=True)
    channel_display = serializers.CharField(
        source="get_channel_display", read_only=True
    )
    context_kind = serializers.CharField(read_only=True)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NotificationTemplate
        fields = [
            "id",
            "event",
            "event_display",
            "channel",
            "channel_display",
            "context_kind",
            "name",
            "description",
            "subject",
            "html_content",
            "text_content",
            "is_active",
            "is_customized",
            "updated_at",
            "updated_by_name",
        ]
        # O par (evento, canal) é do catálogo fixo -- nunca editável.
        read_only_fields = ["event", "channel", "is_customized", "updated_at"]

    def get_updated_by_name(self, obj):
        if obj.updated_by_id is None:
            return None
        return obj.updated_by.full_name or obj.updated_by.email

    def validate(self, attrs):
        instance = self.instance
        channel = attrs.get("channel", getattr(instance, "channel", "email"))
        errors = validate_template_fields(
            channel=channel,
            name=attrs.get("name", getattr(instance, "name", "")),
            subject=attrs.get("subject", getattr(instance, "subject", "")),
            html_content=attrs.get(
                "html_content", getattr(instance, "html_content", "")
            ),
            text_content=attrs.get(
                "text_content", getattr(instance, "text_content", "")
            ),
        )
        if errors:
            raise serializers.ValidationError({"detail": errors})
        return attrs


class NotificationLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = NotificationLog
        fields = [
            "id",
            "event",
            "channel",
            "recipient",
            "subject",
            "status",
            "status_display",
            "error",
            "is_test",
            "created_at",
        ]
