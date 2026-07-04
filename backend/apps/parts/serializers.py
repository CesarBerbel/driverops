from rest_framework import serializers

from apps.categories.models import Category

from .models import Part

NCM_LENGTH = 8


class PartSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(category_type=Category.CategoryType.PART)
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.SerializerMethodField()
    # Declared explicitly (overriding the max_length auto-generated from the
    # model field) so punctuated input like "8708.99.90" can reach
    # validate_ncm() to be normalized to digits-only first -- see the
    # identical pattern in apps/vehicles/serializers.py for chassis/renavam.
    ncm = serializers.CharField(required=False, allow_blank=True, max_length=20)
    barcode = serializers.CharField(required=False, allow_blank=True, max_length=40)

    class Meta:
        model = Part
        fields = [
            "id",
            "category",
            "category_name",
            "name",
            "internal_code",
            "brand",
            "model_application",
            "unit_of_measure",
            "current_quantity",
            "min_quantity",
            "cost_price",
            "sale_price",
            "location",
            "supplier",
            "ncm",
            "barcode",
            "notes",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_is_low_stock(self, obj):
        return obj.is_low_stock

    def validate_category(self, value):
        # A category may only be *newly assigned* while active -- an update
        # that leaves an already-inactive historical category untouched must
        # still pass (preserves the link if the category was disabled later).
        is_new_assignment = (
            self.instance is None or self.instance.category_id != value.id
        )
        if is_new_assignment and not value.is_active:
            raise serializers.ValidationError(
                "Selecione uma categoria de peça habilitada."
            )
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome é obrigatório.")
        return value

    def validate_internal_code(self, value):
        # "Padrão definido no projeto": trim + uppercase, same normalization
        # idiom already used for chassis/plate elsewhere in this codebase.
        return value.strip().upper()

    def validate_brand(self, value):
        return value.strip()

    def validate_model_application(self, value):
        return value.strip()

    def validate_location(self, value):
        return value.strip()

    def validate_supplier(self, value):
        return value.strip()

    def validate_ncm(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and len(digits) != NCM_LENGTH:
            raise serializers.ValidationError("O NCM deve ter 8 dígitos.")
        return digits

    def validate_barcode(self, value):
        return "".join(ch for ch in value if ch.isdigit())

    def validate_current_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "A quantidade atual não pode ser negativa."
            )
        return value

    def validate_min_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O estoque mínimo não pode ser negativo.")
        return value

    def validate_cost_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O preço de custo não pode ser negativo.")
        return value

    def validate_sale_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O preço de venda não pode ser negativo.")
        return value
