from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["order", "amount", "method", "paid_at", "created_by", "created_at"]
    list_filter = ["method", "paid_at"]
    search_fields = ["order__number", "note"]
    autocomplete_fields = ["order"]
