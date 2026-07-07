from django.contrib import admin

from .models import Expense, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["order", "amount", "method", "paid_at", "created_by", "created_at"]
    list_filter = ["method", "paid_at"]
    search_fields = ["order__number", "note"]
    autocomplete_fields = ["order"]


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = [
        "description",
        "category",
        "amount",
        "method",
        "incurred_at",
        "created_by",
    ]
    list_filter = ["category", "method", "incurred_at"]
    search_fields = ["description", "note"]
