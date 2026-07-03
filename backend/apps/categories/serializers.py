from rest_framework import serializers

from .models import Category

DUPLICATE_NAME_MESSAGE = "Já existe uma categoria ativa com este nome."


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome é obrigatório.")
        return value

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", None))
        exclude_pk = self.instance.pk if self.instance is not None else None
        if name and Category.has_active_conflict(name, exclude_pk=exclude_pk):
            raise serializers.ValidationError({"name": DUPLICATE_NAME_MESSAGE})
        return attrs
