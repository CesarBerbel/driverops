from django.contrib import admin

from .models import (
    WorkOrder,
    WorkOrderPackage,
    WorkOrderPart,
    WorkOrderService,
)


class WorkOrderServiceInline(admin.TabularInline):
    model = WorkOrderService
    extra = 0
    autocomplete_fields = ["service"]


class WorkOrderPackageInline(admin.TabularInline):
    model = WorkOrderPackage
    extra = 0
    autocomplete_fields = ["package"]


class WorkOrderPartInline(admin.TabularInline):
    model = WorkOrderPart
    extra = 0
    autocomplete_fields = ["part"]


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = [
        "number",
        "customer",
        "vehicle",
        "status",
        "is_active",
        "updated_at",
    ]
    list_filter = ["is_active", "status"]
    search_fields = ["number", "customer__name", "vehicle__license_plate"]
    autocomplete_fields = ["customer", "vehicle"]
    inlines = [
        WorkOrderServiceInline,
        WorkOrderPackageInline,
        WorkOrderPartInline,
    ]
