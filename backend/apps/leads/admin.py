from django.contrib import admin

from .models import LeadEvent, LeadSettings, SiteLead


@admin.register(SiteLead)
class SiteLeadAdmin(admin.ModelAdmin):
    list_display = ["created_at", "name", "phone", "vehicle_plate", "request_type", "status", "assigned_to"]
    list_filter = ["status", "request_type", "best_period"]
    search_fields = ["name", "phone", "email", "vehicle_plate"]
    readonly_fields = ["created_at", "updated_at", "ip", "user_agent"]


@admin.register(LeadEvent)
class LeadEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "lead", "event_type", "actor"]
    list_filter = ["event_type"]


@admin.register(LeadSettings)
class LeadSettingsAdmin(admin.ModelAdmin):
    list_display = ["is_active", "plate_required", "email_required", "updated_at"]
