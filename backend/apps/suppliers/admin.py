from django.contrib import admin

from .models import Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "trade_name", "supplier_type", "is_active", "updated_at"]
    list_filter = ["supplier_type", "is_active"]
    search_fields = ["name", "trade_name", "document"]
