from rest_framework import serializers

from apps.categories.models import Category
from apps.suppliers.models import Supplier

from .models import Part, StockMovement

NCM_LENGTH = 8


class PartSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(category_type=Category.CategoryType.PART)
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )
    supplier_name = serializers.SerializerMethodField()
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
            "supplier_name",
            "ncm",
            "barcode",
            "notes",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier_id else None

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
        # Same "only a *new* assignment must be active" rule as
        # validate_category -- an update that leaves an already-inactive
        # historical supplier untouched must still pass.
        if value is None:
            return value
        is_new_assignment = (
            self.instance is None or self.instance.supplier_id != value.id
        )
        if is_new_assignment and not value.is_active:
            raise serializers.ValidationError("Selecione um fornecedor habilitado.")
        return value

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


class StockMovementSerializer(serializers.ModelSerializer):
    """Extrato/registro de uma movimentação. Escrita: só `kind`, `quantity` e
    `reason`; o saldo resultante, a OS e o autor são definidos pela view."""

    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    order_number = serializers.IntegerField(source="order.number", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "part",
            "kind",
            "kind_display",
            "quantity",
            "resulting_quantity",
            "reason",
            "order",
            "order_number",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "part",
            "resulting_quantity",
            "order",
            "created_by",
            "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by_id is None:
            return None
        return obj.created_by.full_name or obj.created_by.email

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("A quantidade não pode ser negativa.")
        return value

    def validate_reason(self, value):
        return value.strip()
