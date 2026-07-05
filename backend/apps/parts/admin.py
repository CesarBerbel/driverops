from django.contrib import admin

from .models import Part, StockMovement


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "category",
        "supplier",
        "current_quantity",
        "min_quantity",
        "is_active",
        "updated_at",
    ]
    list_filter = ["is_active", "category", "supplier", "unit_of_measure"]
    search_fields = [
        "name",
        "internal_code",
        "brand",
        "category__name",
        "supplier__name",
    ]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = [
        "part",
        "kind",
        "quantity",
        "resulting_quantity",
        "order",
        "created_by",
        "created_at",
    ]
    list_filter = ["kind", "created_at"]
    search_fields = ["part__name", "reason", "order__number"]
    autocomplete_fields = ["part"]
    readonly_fields = ["created_at"]
