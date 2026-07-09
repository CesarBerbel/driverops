from django.contrib import admin

from .models import CrmCampaign, CrmSettings, CrmSuggestion, CrmTask


@admin.register(CrmSuggestion)
class CrmSuggestionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "suggestion_type",
        "priority",
        "status",
        "customer",
        "created_at",
    )
    list_filter = ("suggestion_type", "priority", "status", "source")
    raw_id_fields = (
        "customer",
        "vehicle",
        "work_order",
        "quote",
        "lead",
        "assigned_to",
    )


@admin.register(CrmTask)
class CrmTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "priority", "customer", "due_date")
    list_filter = ("status", "priority")
    raw_id_fields = (
        "customer",
        "vehicle",
        "work_order",
        "quote",
        "suggestion",
        "assigned_to",
    )


admin.site.register(CrmCampaign)
admin.site.register(CrmSettings)
