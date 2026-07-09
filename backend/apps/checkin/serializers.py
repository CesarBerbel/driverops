from rest_framework import serializers

from .models import (
    ItemStatus,
    VehicleCheckIn,
    VehicleCheckInBelonging,
    VehicleCheckInItem,
    VehicleCheckInPhoto,
    VehicleDamage,
    VehicleDamagePhoto,
)


def _user_name(user):
    if user is None:
        return None
    return user.full_name or user.email


class DamagePhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = VehicleDamagePhoto
        fields = ["id", "url", "caption", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class DamageSerializer(serializers.ModelSerializer):
    photos = DamagePhotoSerializer(many=True, read_only=True)
    region_display = serializers.CharField(source="get_region_display", read_only=True)
    damage_type_display = serializers.CharField(
        source="get_damage_type_display", read_only=True
    )
    severity_display = serializers.CharField(
        source="get_severity_display", read_only=True
    )
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleDamage
        fields = [
            "id",
            "x",
            "y",
            "sequence",
            "region",
            "region_display",
            "damage_type",
            "damage_type_display",
            "severity",
            "severity_display",
            "description",
            "internal_notes",
            "visible_to_customer",
            "photos",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "sequence", "photos", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def validate_description(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Descreva a avaria identificada.")
        return value


class CheckInPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = VehicleCheckInPhoto
        fields = ["id", "category", "category_display", "url", "caption", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleCheckInItem
        fields = ["id", "name", "status", "notes", "position"]


class BelongingSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = VehicleCheckInBelonging
        fields = ["id", "description", "location", "notes", "photo_url", "created_at"]
        read_only_fields = ["id", "photo_url", "created_at"]

    def get_photo_url(self, obj):
        request = self.context.get("request")
        if not obj.photo:
            return ""
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def validate_description(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Descreva o objeto.")
        return value


class CheckInSerializer(serializers.ModelSerializer):
    """Detalhe completo do check-in, com tudo aninhado + resumo."""

    damages = DamageSerializer(many=True, read_only=True)
    photos = CheckInPhotoSerializer(many=True, read_only=True)
    items = ItemSerializer(many=True, read_only=True)
    belongings = BelongingSerializer(many=True, read_only=True)

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    fuel_level_display = serializers.CharField(
        source="get_fuel_level_display", read_only=True
    )
    is_locked = serializers.BooleanField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = VehicleCheckIn
        fields = [
            "id",
            "order",
            "status",
            "status_display",
            "is_locked",
            "mileage",
            "fuel_level",
            "fuel_level_display",
            "external_condition",
            "internal_condition",
            "general_notes",
            "arrived_driving",
            "arrived_towed",
            "customer_present",
            "customer_confirmed",
            "belongings_status",
            "damages",
            "photos",
            "items",
            "belongings",
            "summary",
            "created_by_name",
            "completed_by_name",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        # Só os campos gerais são graváveis por PATCH; o resto tem endpoints próprios.
        read_only_fields = [
            "id",
            "order",
            "status",
            "status_display",
            "is_locked",
            "damages",
            "photos",
            "items",
            "belongings",
            "summary",
            "created_by_name",
            "completed_by_name",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        return _user_name(obj.created_by)

    def get_completed_by_name(self, obj):
        return _user_name(obj.completed_by)

    def get_summary(self, obj):
        damages = list(obj.damages.all())
        photo_count = obj.photos.count() + sum(d.photos.count() for d in damages)
        absent = sum(1 for i in obj.items.all() if i.status == ItemStatus.ABSENT)
        return {
            "damage_count": len(damages),
            "photo_count": photo_count,
            "absent_items_count": absent,
            "has_belongings": obj.belongings.exists(),
        }
