from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = [
        "license_plate",
        "customer",
        "brand",
        "model",
        "is_active",
        "updated_at",
    ]
    list_filter = ["is_active", "fuel_type", "vehicle_type"]
    search_fields = ["license_plate", "brand", "model", "customer__name"]
