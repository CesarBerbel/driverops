from django.contrib import admin

from .models import Part


@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "category",
        "current_quantity",
        "min_quantity",
        "is_active",
        "updated_at",
    ]
    list_filter = ["is_active", "category", "unit_of_measure"]
    search_fields = ["name", "internal_code", "brand", "category__name"]
