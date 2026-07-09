from rest_framework import serializers

from .models import (
    TYPE_MODULE,
    NotifPriority,
    Notification,
    NotificationPreference,
    NotificationRule,
)


class NotificationSerializer(serializers.ModelSerializer):
    notif_type_display = serializers.CharField(source="get_notif_type_display", read_only=True)
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_read = serializers.BooleanField(read_only=True)
    audience_role_name = serializers.CharField(source="audience_role.name", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            "id",
            "notif_type",
            "notif_type_display",
            "module",
            "module_display",
            "title",
            "message",
            "detail",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "is_read",
            "related_type",
            "related_id",
            "url",
            "action_label",
            "data",
            "origin",
            "audience_role_name",
            "created_at",
            "read_at",
        ]
        read_only_fields = fields


class NotificationRuleSerializer(serializers.ModelSerializer):
    notif_type_display = serializers.CharField(source="get_notif_type_display", read_only=True)
    module = serializers.SerializerMethodField()

    class Meta:
        model = NotificationRule
        fields = [
            "notif_type",
            "notif_type_display",
            "module",
            "is_enabled",
            "priority",
            "lead_time_hours",
            "stall_days",
            "recipient_roles",
            "show_in_bell",
            "send_email",
            "show_in_dashboard",
            "group_similar",
            "auto_expire_days",
            "updated_at",
        ]
        read_only_fields = ["notif_type", "notif_type_display", "module", "updated_at"]

    def get_module(self, obj):
        return TYPE_MODULE.get(obj.notif_type, "")


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "muted_modules",
            "only_assigned",
            "only_high_priority",
            "mute_informational",
            "sound_enabled",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class ManualNotificationSerializer(serializers.Serializer):
    """Entrada para um aviso manual. Conteúdo é texto puro (sem HTML)."""

    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    role_key = serializers.CharField(required=False, allow_blank=True, max_length=32)
    title = serializers.CharField(max_length=200)
    message = serializers.CharField(max_length=500)
    detail = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    priority = serializers.ChoiceField(
        choices=NotifPriority.choices, default=NotifPriority.IMPORTANT
    )
    url = serializers.CharField(required=False, allow_blank=True, max_length=300)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Informe um título.")
        return value

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Informe uma mensagem.")
        return value

    def validate(self, attrs):
        if not attrs.get("recipient_ids") and not (attrs.get("role_key") or "").strip():
            raise serializers.ValidationError(
                {"recipient_ids": "Informe ao menos um destinatário ou um perfil."}
            )
        return attrs
