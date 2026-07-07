from rest_framework import serializers

from apps.orders.models import WorkOrder

from .models import Expense, Payment


class PaymentSerializer(serializers.ModelSerializer):
    order = serializers.PrimaryKeyRelatedField(queryset=WorkOrder.objects.all())
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "amount",
            "method",
            "method_display",
            "paid_at",
            "note",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "method_display", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by_id is None:
            return None
        return obj.created_by.full_name or obj.created_by.email

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "O valor do pagamento deve ser maior que zero."
            )
        return value

    def validate_note(self, value):
        return value.strip()


class ExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "description",
            "category",
            "category_display",
            "amount",
            "method",
            "method_display",
            "incurred_at",
            "note",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "category_display",
            "method_display",
            "created_by_name",
            "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by_id is None:
            return None
        return obj.created_by.full_name or obj.created_by.email

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("A descrição é obrigatória.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return value

    def validate_note(self, value):
        return value.strip()
