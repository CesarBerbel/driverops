from rest_framework import serializers

from .models import Category

DUPLICATE_NAME_MESSAGE = "Já existe uma categoria ativa com este nome."
CATEGORY_TYPE_IMMUTABLE_MESSAGE = "O tipo da categoria não pode ser alterado."


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            "id",
            "category_type",
            "name",
            "description",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome é obrigatório.")
        return value

    def validate(self, attrs):
        # category_type is required on create but immutable afterward -- the
        # frontend never sends it on update, so this only guards against a
        # stray/malicious PATCH silently moving a category between types.
        if self.instance is not None:
            new_type = attrs.get("category_type")
            if new_type is not None and new_type != self.instance.category_type:
                raise serializers.ValidationError(
                    {"category_type": CATEGORY_TYPE_IMMUTABLE_MESSAGE}
                )
            category_type = self.instance.category_type
        else:
            category_type = attrs.get("category_type")

        name = attrs.get("name", getattr(self.instance, "name", None))
        exclude_pk = self.instance.pk if self.instance is not None else None
        if (
            name
            and category_type
            and Category.has_active_conflict(category_type, name, exclude_pk=exclude_pk)
        ):
            raise serializers.ValidationError({"name": DUPLICATE_NAME_MESSAGE})
        return attrs
