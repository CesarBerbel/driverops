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
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_result_limit(self, value):
        if not (1 <= value <= 100):
            raise serializers.ValidationError("O limite deve estar entre 1 e 100.")
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
