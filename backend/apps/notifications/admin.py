from django.contrib import admin

from .models import NotificationLog, NotificationTemplate


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = [
        "event",
        "channel",
        "name",
        "is_active",
        "is_customized",
        "updated_at",
    ]
    list_filter = ["channel", "is_active", "is_customized"]
    search_fields = ["name", "description", "event"]
    readonly_fields = ["updated_at", "updated_by", "is_customized"]


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "event", "channel", "recipient", "status", "is_test"]
    list_filter = ["channel", "status", "is_test"]
    search_fields = ["recipient", "event", "subject"]
    readonly_fields = [f.name for f in NotificationLog._meta.fields]
