from decimal import Decimal

from rest_framework import serializers

from apps.categories.models import Category
from apps.parts.models import Part

from .models import PackageService, Service, ServicePackage, ServicePart

CENTS = Decimal("0.01")


def money(value):
    """Quantiza um Decimal para 2 casas (centavos) para saída consistente."""
    return value.quantize(CENTS)


def service_value(service):
    """Valor de um serviço = mão de obra + Σ(quantidade sugerida × preço de venda).

    Peça sem preço de venda conta como zero. Cálculo dinâmico (não persistido).
    """
    total = service.labor_cost or Decimal("0")
    for link in service.standard_parts.all():
        sale_price = link.part.sale_price or Decimal("0")
        total += link.suggested_quantity * sale_price
    return money(total)


class ServicePartSerializer(serializers.ModelSerializer):
    # queryset is NOT filtered by is_active so an already-linked part that was
    # later disabled stays valid on read/update -- the "new assignment must be
    # active" rule is enforced at the collection level in
    # ServiceSerializer.validate_standard_parts.
    part = serializers.PrimaryKeyRelatedField(queryset=Part.objects.all())
    part_name = serializers.CharField(source="part.name", read_only=True)

    class Meta:
        model = ServicePart
        fields = ["part", "part_name", "suggested_quantity"]

    def validate_suggested_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "A quantidade sugerida não pode ser negativa."
            )
        return value


class ServiceSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(category_type=Category.CategoryType.SERVICE)
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    standard_parts = ServicePartSerializer(many=True, required=False)
    value = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "category",
            "category_name",
            "description",
            "labor_cost",
            "estimated_minutes",
            "notes",
            "standard_parts",
            "value",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_value(self, obj):
        return str(service_value(obj))

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome do serviço é obrigatório.")
        return value

    def validate_category(self, value):
        # A category may only be *newly assigned* while active -- an update that
        # leaves an already-inactive historical category untouched must pass.
        is_new_assignment = (
            self.instance is None or self.instance.category_id != value.id
        )
        if is_new_assignment and not value.is_active:
            raise serializers.ValidationError(
                "Selecione uma categoria de serviço habilitada."
            )
        return value

    def validate_labor_cost(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "O valor de mão de obra não pode ser negativo."
            )
        return value

    def validate_standard_parts(self, items):
        seen = set()
        # Parts already linked to this service (on update) are "existing" -- a
        # disabled part among them is preserved; only a *new* disabled part is
        # rejected. Mirrors the FK is_new_assignment idiom at the list level.
        existing_ids = set()
        if self.instance is not None:
            existing_ids = set(
                self.instance.standard_parts.values_list("part_id", flat=True)
            )
        for item in items:
            part = item["part"]
            if part.id in seen:
                raise serializers.ValidationError(
                    "Não é possível vincular a mesma peça mais de uma vez."
                )
            seen.add(part.id)
            if not part.is_active and part.id not in existing_ids:
                raise serializers.ValidationError("Selecione uma peça habilitada.")
        return items

    def create(self, validated_data):
        standard_parts = validated_data.pop("standard_parts", [])
        service = Service.objects.create(**validated_data)
        ServicePart.objects.bulk_create(
            ServicePart(service=service, **item) for item in standard_parts
        )
        return service

    def update(self, instance, validated_data):
        standard_parts = validated_data.pop("standard_parts", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if standard_parts is not None:
            # Replace-all: the collection-level validation above already
            # guaranteed no *new* disabled part slipped in.
            instance.standard_parts.all().delete()
            ServicePart.objects.bulk_create(
                ServicePart(service=instance, **item) for item in standard_parts
            )
        return instance


class PackageServiceSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all())
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_value = serializers.SerializerMethodField()

    class Meta:
        model = PackageService
        fields = ["service", "service_name", "service_value"]

    def get_service_value(self, obj):
        return str(service_value(obj.service))


class ServicePackageSerializer(serializers.ModelSerializer):
    items = PackageServiceSerializer(many=True)
    total_value = serializers.SerializerMethodField()
    final_value = serializers.SerializerMethodField()

    class Meta:
        model = ServicePackage
        fields = [
            "id",
            "name",
            "description",
            "items",
            "total_value",
            "discount_type",
            "discount_value",
            "final_value",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _total(self, obj):
        return money(
            sum(
                (service_value(link.service) for link in obj.items.all()),
                Decimal("0"),
            )
        )

    def get_total_value(self, obj):
        return str(self._total(obj))

    def get_final_value(self, obj):
        total = self._total(obj)
        discount = Decimal("0")
        if obj.discount_type == ServicePackage.DiscountType.PERCENT:
            discount = total * (obj.discount_value or Decimal("0")) / Decimal("100")
        elif obj.discount_type == ServicePackage.DiscountType.FIXED:
            discount = obj.discount_value or Decimal("0")
        final = total - discount
        if final < 0:
            final = Decimal("0")
        return str(money(final))

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("O nome do pacote é obrigatório.")
        return value

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError(
                "O pacote deve ter ao menos um serviço vinculado."
            )
        seen = set()
        existing_ids = set()
        if self.instance is not None:
            existing_ids = set(self.instance.items.values_list("service_id", flat=True))
        for item in items:
            service = item["service"]
            if service.id in seen:
                raise serializers.ValidationError(
                    "Não é possível vincular o mesmo serviço mais de uma vez."
                )
            seen.add(service.id)
            if not service.is_active and service.id not in existing_ids:
                raise serializers.ValidationError("Selecione um serviço habilitado.")
        return items

    def validate(self, attrs):
        discount_type = attrs.get(
            "discount_type",
            getattr(self.instance, "discount_type", ServicePackage.DiscountType.NONE),
        )
        discount_value = attrs.get(
            "discount_value",
            getattr(self.instance, "discount_value", Decimal("0")),
        )
        if discount_type == ServicePackage.DiscountType.NONE:
            attrs["discount_value"] = Decimal("0")
        elif discount_type == ServicePackage.DiscountType.PERCENT:
            if discount_value < 0 or discount_value > 100:
                raise serializers.ValidationError(
                    {
                        "discount_value": "O desconto percentual deve estar entre 0 e 100."
                    }
                )
        elif discount_type == ServicePackage.DiscountType.FIXED:
            if discount_value < 0:
                raise serializers.ValidationError(
                    {"discount_value": "O desconto não pode ser negativo."}
                )
        return attrs

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        package = ServicePackage.objects.create(**validated_data)
        PackageService.objects.bulk_create(
            PackageService(package=package, **item) for item in items
        )
        return package

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            PackageService.objects.bulk_create(
                PackageService(package=instance, **item) for item in items
            )
        return instance
