from django.contrib import admin

from .models import Notification, NotificationPreference, NotificationRule


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "module", "priority", "status", "created_at")
    list_filter = ("module", "priority", "status", "origin")
    search_fields = ("title", "message", "recipient__email")
    raw_id_fields = ("recipient", "created_by", "audience_role")


@admin.register(NotificationRule)
class NotificationRuleAdmin(admin.ModelAdmin):
    list_display = ("notif_type", "is_enabled", "priority", "lead_time_hours", "stall_days")
    list_filter = ("is_enabled",)


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "only_assigned", "only_high_priority", "mute_informational")
