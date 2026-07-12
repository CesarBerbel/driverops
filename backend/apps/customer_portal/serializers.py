from rest_framework import serializers

from .models import CustomerPortalSettings


class CustomerPortalSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerPortalSettings
        fields = [
            "enabled",
            "require_email",
            "link_validity_hours",
            "single_use_token",
            "resend_cooldown_seconds",
            "show_history",
            "allow_messages",
            "allow_pdf_download",
            "notify_on_access",
            "notify_on_message",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_link_validity_hours(self, value):
        if not (1 <= value <= 168):
            raise serializers.ValidationError(
                "A validade deve estar entre 1 e 168 horas."
            )
        return value

    def validate_resend_cooldown_seconds(self, value):
        if not (0 <= value <= 3600):
            raise serializers.ValidationError(
                "O intervalo de reenvio deve estar entre 0 e 3600 segundos."
            )
        return value
