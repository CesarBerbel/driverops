from django.contrib import admin

from .models import (
    VehicleCheckIn,
    VehicleCheckInBelonging,
    VehicleCheckInItem,
    VehicleCheckInPhoto,
    VehicleDamage,
    VehicleDamagePhoto,
)


@admin.register(VehicleCheckIn)
class VehicleCheckInAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "status", "completed_at", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("order", "created_by", "updated_by", "completed_by")


admin.site.register(VehicleDamage)
admin.site.register(VehicleDamagePhoto)
admin.site.register(VehicleCheckInPhoto)
admin.site.register(VehicleCheckInItem)
admin.site.register(VehicleCheckInBelonging)
