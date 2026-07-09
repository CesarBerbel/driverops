from rest_framework import serializers

from .fields import CONTEXT_GROUP_KEYS
from .models import AIFieldInstruction, AISettings, AIUsageLog


class AISettingsSerializer(serializers.ModelSerializer):
    provider_display = serializers.CharField(
        source="get_provider_display", read_only=True
    )
    key_configured = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AISettings
        fields = [
            "is_active",
            "provider",
            "provider_display",
            "model",
            "base_url",
            "api_key_env",
            "temperature",
            "max_tokens",
            "timeout_seconds",
            "global_prompt",
            "log_texts",
            "retention_days",
            "key_configured",
            "updated_at",
            "updated_by_name",
        ]
        read_only_fields = ["updated_at"]

    def get_key_configured(self, obj):
        import os

        from .providers import DEFAULT_KEY_ENV

        env_name = (obj.api_key_env or "").strip() or DEFAULT_KEY_ENV.get(
            obj.provider, "AI_ASSISTANT_API_KEY"
        )
        return bool(os.environ.get(env_name, "").strip())

    def get_updated_by_name(self, obj):
        if obj.updated_by_id is None:
            return None
        return obj.updated_by.full_name or obj.updated_by.email

    def validate_temperature(self, value):
        if not (0 <= value <= 2):
            raise serializers.ValidationError("A temperatura deve estar entre 0 e 2.")
        return value

    def validate_max_tokens(self, value):
        if not (1 <= value <= 8000):
            raise serializers.ValidationError(
                "Máximo de tokens deve estar entre 1 e 8000."
            )
        return value

    def validate_timeout_seconds(self, value):
        if not (1 <= value <= 120):
            raise serializers.ValidationError(
                "O timeout deve estar entre 1 e 120 segundos."
            )
        return value


class AIFieldInstructionSerializer(serializers.ModelSerializer):
    field_key_display = serializers.CharField(
        source="get_field_key_display", read_only=True
    )
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AIFieldInstruction
        fields = [
            "id",
            "field_key",
            "field_key_display",
            "name",
            "description",
            "instruction",
            "tone",
            "detail_level",
            "audience",
            "can_rewrite",
            "can_fix_grammar",
            "can_summarize",
            "can_expand",
            "use_context",
            "allowed_context",
            "preserve_technical_terms",
            "keep_first_person",
            "remove_slang",
            "visible_to_customer",
            "is_active",
            "is_customized",
            "updated_at",
            "updated_by_name",
        ]
        read_only_fields = ["field_key", "is_customized", "updated_at"]

    def get_updated_by_name(self, obj):
        if obj.updated_by_id is None:
            return None
        return obj.updated_by.full_name or obj.updated_by.email

    def validate_instruction(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("A instrução principal é obrigatória.")
        return value

    def validate_allowed_context(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Contexto permitido deve ser uma lista.")
        invalid = [g for g in value if g not in CONTEXT_GROUP_KEYS]
        if invalid:
            raise serializers.ValidationError(
                f"Grupos de contexto inválidos: {', '.join(invalid)}."
            )
        return value


class AIUsageLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AIUsageLog
        fields = [
            "id",
            "user_name",
            "work_order",
            "field_key",
            "action",
            "provider",
            "model",
            "status",
            "status_display",
            "error_code",
            "input_tokens",
            "output_tokens",
            "is_test",
            "applied",
            "created_at",
        ]

    def get_user_name(self, obj):
        if obj.user_id is None:
            return None
        return obj.user.full_name or obj.user.email
