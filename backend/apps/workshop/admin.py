from django.contrib import admin

from .models import OrderSettings, WorkshopProfile


@admin.register(WorkshopProfile)
class WorkshopProfileAdmin(admin.ModelAdmin):
    list_display = ["trade_name", "cnpj", "city", "state", "updated_at"]


@admin.register(OrderSettings)
class OrderSettingsAdmin(admin.ModelAdmin):
    list_display = ["default_delivery_days", "updated_at"]
