from datetime import timedelta
from decimal import Decimal

from rest_framework import serializers

from apps.customers.models import Customer
from apps.parts.models import Part
from apps.services.models import Service, ServicePackage
from apps.vehicles.models import Vehicle
from apps.workshop.models import OrderSettings

from .models import (
    WorkOrder,
    WorkOrderPackage,
    WorkOrderPart,
    WorkOrderService,
)

CENTS = Decimal("0.01")


def money(value):
    """Quantiza um Decimal para 2 casas (centavos) para saída consistente."""
    return Decimal(value).quantize(CENTS)


def line_total(item):
    """Subtotal de uma linha = quantidade × valor unitário (>= 0)."""
    quantity = item.quantity or Decimal("0")
    unit_price = item.unit_price or Decimal("0")
    total = quantity * unit_price
    if total < 0:
        total = Decimal("0")
    return money(total)


class _WorkOrderLineSerializer(serializers.ModelSerializer):
    """Base para as linhas de serviço/pacote/peça da OS.

    Cada linha pode ser *cadastrada* (FK preenchida) ou *avulsa* (FK nula, nome
    livre em `description`). Os valores são congelados (snapshot) na OS, então a
    FK não é revalidada por is_active -- o combobox do frontend já só oferece
    itens habilitados, e itens históricos precisam continuar válidos.
    """

    # Subclasses set these.
    fk_field = None

    line_total = serializers.SerializerMethodField()
    is_custom = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    def get_line_total(self, obj):
        return str(line_total(obj))

    def get_is_custom(self, obj):
        return getattr(obj, self.fk_field) is None

    def get_display_name(self, obj):
        if obj.description:
            return obj.description
        linked = getattr(obj, self.fk_field)
        return linked.name if linked is not None else ""

    def validate_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("A quantidade não pode ser negativa.")
        return value

    def validate_unit_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("O valor não pode ser negativo.")
        return value

    def validate(self, attrs):
        # An avulso line (no FK) must carry a free-text name.
        linked = attrs.get(self.fk_field)
        description = (attrs.get("description") or "").strip()
        if linked is None and not description:
            raise serializers.ValidationError(
                {"description": "Informe uma descrição para o item avulso."}
            )
        attrs["description"] = description
        return attrs


class WorkOrderServiceSerializer(_WorkOrderLineSerializer):
    fk_field = "service"

    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), required=False, allow_null=True
    )
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = WorkOrderService
        fields = [
            "service",
            "service_name",
            "description",
            "display_name",
            "quantity",
            "unit_price",
            "line_total",
            "is_custom",
        ]


class WorkOrderPackageSerializer(_WorkOrderLineSerializer):
    fk_field = "package"

    package = serializers.PrimaryKeyRelatedField(
        queryset=ServicePackage.objects.all(), required=False, allow_null=True
    )
    package_name = serializers.CharField(source="package.name", read_only=True)

    class Meta:
        model = WorkOrderPackage
        fields = [
            "package",
            "package_name",
            "description",
            "display_name",
            "quantity",
            "unit_price",
            "line_total",
            "is_custom",
        ]


class WorkOrderPartSerializer(_WorkOrderLineSerializer):
    fk_field = "part"

    part = serializers.PrimaryKeyRelatedField(
        queryset=Part.objects.all(), required=False, allow_null=True
    )
    part_name = serializers.CharField(source="part.name", read_only=True)

    class Meta:
        model = WorkOrderPart
        fields = [
            "part",
            "part_name",
            "description",
            "display_name",
            "quantity",
            "unit_price",
            "line_total",
            "is_custom",
        ]


class WorkOrderSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all())
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.all())
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_whatsapp = serializers.CharField(
        source="customer.whatsapp", read_only=True
    )
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    vehicle_plate = serializers.CharField(
        source="vehicle.license_plate", read_only=True
    )
    vehicle_description = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    service_items = WorkOrderServiceSerializer(many=True, required=False)
    package_items = WorkOrderPackageSerializer(many=True, required=False)
    part_items = WorkOrderPartSerializer(many=True, required=False)

    services_total = serializers.SerializerMethodField()
    packages_total = serializers.SerializerMethodField()
    parts_total = serializers.SerializerMethodField()
    gross_total = serializers.SerializerMethodField()
    final_value = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Once an OS exists, its vehicle and customer are fixed -- they can only
        # be chosen on creation. Locking them read-only on update also keeps the
        # vehicle/customer consistency guaranteed at creation time.
        if self.instance is not None:
            self.fields["customer"].read_only = True
            self.fields["vehicle"].read_only = True

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "number",
            "customer",
            "customer_name",
            "customer_whatsapp",
            "customer_phone",
            "vehicle",
            "vehicle_plate",
            "vehicle_description",
            "status",
            "status_display",
            "opened_at",
            "expected_delivery",
            "current_mileage",
            "customer_report",
            "diagnosis",
            "internal_notes",
            "service_items",
            "package_items",
            "part_items",
            "discount_type",
            "discount_value",
            "services_total",
            "packages_total",
            "parts_total",
            "gross_total",
            "final_value",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at"]

    # --- computed values (backend is the source of truth) ---

    def get_vehicle_description(self, obj):
        parts = [obj.vehicle.brand, obj.vehicle.model]
        return " ".join(p for p in parts if p).strip()

    def _services_total(self, obj):
        return money(
            sum((line_total(i) for i in obj.service_items.all()), Decimal("0"))
        )

    def _packages_total(self, obj):
        return money(
            sum((line_total(i) for i in obj.package_items.all()), Decimal("0"))
        )

    def _parts_total(self, obj):
        return money(sum((line_total(i) for i in obj.part_items.all()), Decimal("0")))

    def _gross_total(self, obj):
        return money(
            self._services_total(obj)
            + self._packages_total(obj)
            + self._parts_total(obj)
        )

    def get_services_total(self, obj):
        return str(self._services_total(obj))

    def get_packages_total(self, obj):
        return str(self._packages_total(obj))

    def get_parts_total(self, obj):
        return str(self._parts_total(obj))

    def get_gross_total(self, obj):
        return str(self._gross_total(obj))

    def get_final_value(self, obj):
        gross = self._gross_total(obj)
        discount = Decimal("0")
        if obj.discount_type == WorkOrder.DiscountType.PERCENT:
            discount = gross * (obj.discount_value or Decimal("0")) / Decimal("100")
        elif obj.discount_type == WorkOrder.DiscountType.FIXED:
            discount = obj.discount_value or Decimal("0")
        final = gross - discount
        if final < 0:
            final = Decimal("0")
        return str(money(final))

    # --- validation ---

    def validate_customer_report(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O relato do cliente é obrigatório.")
        return value

    def validate_opened_at(self, value):
        if value is None:
            raise serializers.ValidationError("A data de abertura é obrigatória.")
        return value

    def validate_vehicle(self, value):
        # A vehicle may only be *newly assigned* while active -- an update that
        # keeps an already-disabled historical vehicle must still pass.
        is_new_assignment = (
            self.instance is None or self.instance.vehicle_id != value.id
        )
        if is_new_assignment and not value.is_active:
            raise serializers.ValidationError("Selecione um veículo habilitado.")
        return value

    def validate(self, attrs):
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        if customer is not None and vehicle is not None:
            if vehicle.customer_id != customer.id:
                raise serializers.ValidationError(
                    {
                        "vehicle": (
                            "O veículo selecionado não pertence ao cliente informado."
                        )
                    }
                )

        discount_type = attrs.get(
            "discount_type",
            getattr(self.instance, "discount_type", WorkOrder.DiscountType.NONE),
        )
        discount_value = attrs.get(
            "discount_value", getattr(self.instance, "discount_value", Decimal("0"))
        )
        if discount_type == WorkOrder.DiscountType.NONE:
            attrs["discount_value"] = Decimal("0")
        elif discount_type == WorkOrder.DiscountType.PERCENT:
            if discount_value < 0 or discount_value > 100:
                raise serializers.ValidationError(
                    {
                        "discount_value": "O desconto percentual deve estar entre 0 e 100."
                    }
                )
        elif discount_type == WorkOrder.DiscountType.FIXED:
            if discount_value < 0:
                raise serializers.ValidationError(
                    {"discount_value": "O desconto não pode ser negativo."}
                )
        return attrs

    # --- nested writes (replace-all, same strategy as ServicePackage) ---

    def _write_lines(self, order, service_items, package_items, part_items):
        if service_items is not None:
            order.service_items.all().delete()
            WorkOrderService.objects.bulk_create(
                WorkOrderService(order=order, **item) for item in service_items
            )
        if package_items is not None:
            order.package_items.all().delete()
            WorkOrderPackage.objects.bulk_create(
                WorkOrderPackage(order=order, **item) for item in package_items
            )
        if part_items is not None:
            order.part_items.all().delete()
            WorkOrderPart.objects.bulk_create(
                WorkOrderPart(order=order, **item) for item in part_items
            )

    def create(self, validated_data):
        service_items = validated_data.pop("service_items", [])
        package_items = validated_data.pop("package_items", [])
        part_items = validated_data.pop("part_items", [])
        # Auto-fill the expected delivery from the global default deadline when
        # the caller didn't provide one -- data de abertura + prazo padrão. Only
        # applied at creation, so editing the global default never touches an
        # existing OS.
        if "expected_delivery" not in validated_data:
            opened_at = validated_data.get("opened_at")
            if opened_at is not None:
                days = OrderSettings.get_solo().default_delivery_days
                validated_data["expected_delivery"] = opened_at + timedelta(days=days)
        order = WorkOrder.objects.create(**validated_data)
        self._write_lines(order, service_items, package_items, part_items)
        return order

    def update(self, instance, validated_data):
        service_items = validated_data.pop("service_items", None)
        package_items = validated_data.pop("package_items", None)
        part_items = validated_data.pop("part_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._write_lines(instance, service_items, package_items, part_items)
        return instance
