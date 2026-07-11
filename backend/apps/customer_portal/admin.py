from django.contrib import admin

from .models import CustomerPortalSettings, PortalMessage, VehicleAccessToken


@admin.register(CustomerPortalSettings)
class CustomerPortalSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "enabled",
        "link_validity_hours",
        "single_use_token",
        "allow_messages",
    )


@admin.register(VehicleAccessToken)
class VehicleAccessTokenAdmin(admin.ModelAdmin):
    list_display = (
        "vehicle",
        "customer",
        "computed_status",
        "created_at",
        "expires_at",
    )
    list_filter = ("revoked",)
    readonly_fields = ("token_hash", "created_at")
    search_fields = ("email",)


@admin.register(PortalMessage)
class PortalMessageAdmin(admin.ModelAdmin):
    list_display = ("vehicle", "customer", "kind", "created_at")
    list_filter = ("kind",)
