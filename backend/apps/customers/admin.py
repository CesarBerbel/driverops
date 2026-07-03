from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "customer_type", "city", "state", "updated_at"]
    list_filter = ["customer_type", "state"]
    search_fields = ["name", "email", "document"]
