from rest_framework import serializers

from .models import RecentSearch, SavedSearch, SmartSearchSettings


class SmartSearchSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmartSearchSettings
        fields = [
            "use_ai",
            "include_internal_notes",
            "include_financial",
            "result_limit",
            "store_history",
            "log_queries",
            "retention_days",
            "semantic_enabled",
            "embedding_provider",
            "embedding_model",
            "embedding_base_url",
            "embedding_api_key_env",
            "embedding_dimensions",
            "similarity_threshold",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_result_limit(self, value):
        if not (1 <= value <= 100):
            raise serializers.ValidationError("O limite deve estar entre 1 e 100.")
        return value

    def validate_similarity_threshold(self, value):
        if not (0.0 <= value <= 1.0):
            raise serializers.ValidationError("O limiar deve estar entre 0 e 1.")
        return value

    def validate_embedding_dimensions(self, value):
        if not (16 <= value <= 3072):
            raise serializers.ValidationError("A dimensão deve estar entre 16 e 3072.")
        return value


class SearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=500, trim_whitespace=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100)
    filters = serializers.DictField(required=False)


class RecentSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecentSearch
        fields = ["id", "query", "updated_at"]


class SavedSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedSearch
        fields = ["id", "label", "query", "filters", "created_at"]
        read_only_fields = ["created_at"]
