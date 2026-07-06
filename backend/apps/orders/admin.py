from django.contrib import admin

from .models import (
    OrderAttachment,
    OrderEvent,
    OrderStatusHistory,
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


@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["order", "from_status", "to_status", "changed_by", "created_at"]
    list_filter = ["to_status", "created_at"]
    search_fields = ["order__number"]


@admin.register(OrderAttachment)
class OrderAttachmentAdmin(admin.ModelAdmin):
    list_display = [
        "order",
        "original_name",
        "category",
        "content_type",
        "size",
        "created_at",
    ]
    list_filter = ["category"]
    search_fields = ["order__number", "original_name", "caption"]


@admin.register(OrderEvent)
class OrderEventAdmin(admin.ModelAdmin):
    list_display = ["order", "event_type", "description", "actor", "created_at"]
    list_filter = ["event_type", "created_at"]
    search_fields = ["order__number", "description"]
